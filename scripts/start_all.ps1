# Brings the entire local dev stack online with a single command:
#   powershell -ExecutionPolicy Bypass -File scripts\start_all.ps1
#
# Starts Docker Desktop (if needed) -> infra containers (mongodb, milvus
# stack, ollama) -> pulls required Ollama models -> launches the FastAPI
# backend on the host (matching this repo's .venv + host-mode .env URIs) ->
# waits for /live, /ready, /health to report good status.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$composeFile = "docker-compose_local.yaml"
$backendUrl = "http://localhost:8000"

function Wait-DockerDaemon {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }

    $dockerExe = Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe" -ErrorAction SilentlyContinue
    if (-not $dockerExe) {
        $dockerExe = Get-ChildItem -Path "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    }
    if (-not $dockerExe) { throw "Docker Desktop.exe not found - install Docker Desktop first." }

    Write-Host "Starting Docker Desktop..."
    Start-Process $dockerExe.FullName

    for ($i = 0; $i -lt 60; $i++) {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { Write-Host "Docker daemon is up."; return }
        Start-Sleep -Seconds 3
    }
    throw "Docker daemon did not come up within 180s."
}

function Wait-ContainerHealthy($name, $timeoutSec = 180) {
    $elapsed = 0
    while ($elapsed -lt $timeoutSec) {
        $status = docker inspect --format="{{.State.Health.Status}}" $name 2>$null
        if ($status -eq "healthy") { Write-Host "$name : healthy"; return }
        Start-Sleep -Seconds 3
        $elapsed += 3
    }
    throw "$name did not become healthy within ${timeoutSec}s (last status: $status)"
}

Wait-DockerDaemon

Write-Host "Starting infra containers (mongodb, etcd, minio, milvus, ollama)..."
docker compose -f $composeFile up -d mongodb etcd minio milvus ollama
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

Wait-ContainerHealthy "mongodb"
Wait-ContainerHealthy "milvus-etcd"
Wait-ContainerHealthy "milvus-minio"
Wait-ContainerHealthy "milvus" 240
Wait-ContainerHealthy "ollama"

Write-Host "Ensuring Ollama models are present (pulls only if missing)..."
$existingModels = docker compose -f $composeFile exec -T ollama ollama list
foreach ($model in @("nomic-embed-text", "llama3")) {
    if ($existingModels -notmatch [regex]::Escape($model)) {
        Write-Host "Pulling $model ..."
        docker compose -f $composeFile exec -T ollama ollama pull $model
    } else {
        Write-Host "$model already present."
    }
}

Write-Host "Starting backend (uvicorn) on host..."
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$stdout = Join-Path $root "backend.log"
$stderr = Join-Path $root "backend.err.log"
$proc = Start-Process -FilePath $venvPython -ArgumentList "app.py" -WorkingDirectory $root `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
$proc.Id | Out-File -FilePath (Join-Path $root "backend.pid") -Encoding ascii

Write-Host "Waiting for backend to respond on $backendUrl ..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "$backendUrl/live" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw "Backend did not come online within 120s - check backend.err.log" }

Write-Host ""
Write-Host "=== Backend is online at $backendUrl (pid $($proc.Id), logs: backend.log / backend.err.log) ==="
(Invoke-WebRequest -Uri "$backendUrl/health" -UseBasicParsing).Content
