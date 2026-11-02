"""Concurrent load test against the running Miravelt backend.

Usage:
    .venv/Scripts/python.exe scripts/stress_test.py
    .venv/Scripts/python.exe scripts/stress_test.py --with-uploads   # also run phase 3 (see below)

Three phases:
  1. Raw throughput/latency against /live and /health - these carry no
     @limiter.limit decorator (see core/rate_limiter.py, routers/*), so
     this measures actual server capacity under concurrency.
  2. A burst against POST /auth/login (10/minute, routers/auth.py:90) to
     confirm the rate limiter actually rejects excess traffic with 429 -
     that's correct enforcement, not a failure.
  3. (--with-uploads only) Real concurrent statement uploads through the
     actual Celery dispatch (tasks/statement_tasks.py), each polled to
     completion. This is what HOMELAB_CHECKLIST.md §0 means by "load-test
     before fixing a worker-concurrency number" - the real ceiling is the
     Ollama instance's insight-generation throughput, not this script or
     FastAPI. Off by default: it's slow (each upload takes real processing
     time) and mutates real state (registers throwaway users, creates real
     statements) - opt in deliberately, against a deployment you're
     actually trying to size, not CI.
"""

import argparse
import asyncio
import os
import time
import uuid

import httpx

BASE_URL = os.environ.get("MIRAVELT_STRESS_BASE_URL", "http://localhost:8000")
API_KEY = os.environ.get("MIRAVELT_API_KEY", "")
TOTAL_REQUESTS = 500
CONCURRENCY = 50
MOCK_STATEMENT_PATH = os.path.join(os.path.dirname(__file__), "..", "mock", "gpay_statement_20260101_20260630.pdf")


async def fire_get(client: httpx.AsyncClient, url: str, headers: dict, results: list, sem: asyncio.Semaphore):
    async with sem:
        start = time.perf_counter()
        try:
            resp = await client.get(url, headers=headers)
            results.append((resp.status_code, time.perf_counter() - start))
        except Exception as exc:
            results.append((f"error:{exc.__class__.__name__}", time.perf_counter() - start))


async def fire_login(client: httpx.AsyncClient, results: list, sem: asyncio.Semaphore):
    async with sem:
        start = time.perf_counter()
        try:
            resp = await client.post(
                f"{BASE_URL}/auth/login",
                headers={"X-Miravelt-API-Key": API_KEY, "Content-Type": "application/json"},
                json={"email": "stress-test@example.com", "password": "wrong-password"},
            )
            results.append((resp.status_code, time.perf_counter() - start))
        except Exception as exc:
            results.append((f"error:{exc.__class__.__name__}", time.perf_counter() - start))


def summarize(name: str, url: str, total: int, concurrency: int, wall: float, results: list):
    latencies = sorted(r[1] for r in results)
    statuses: dict[object, int] = {}
    for status, _ in results:
        statuses[status] = statuses.get(status, 0) + 1

    def pct(p):
        idx = min(len(latencies) - 1, int(len(latencies) * p))
        return latencies[idx] * 1000

    print(f"\n=== {name} ===")
    print(f"target: {url}")
    print(f"requests: {total}, concurrency: {concurrency}, wall time: {wall:.2f}s")
    print(f"throughput: {total / wall:.1f} req/s")
    print(f"latency ms: min={latencies[0]*1000:.1f} p50={pct(0.50):.1f} p95={pct(0.95):.1f} p99={pct(0.99):.1f} max={latencies[-1]*1000:.1f}")
    print(f"status breakdown: {statuses}")


async def run_get_batch(name: str, url: str, headers: dict, total: int, concurrency: int):
    sem = asyncio.Semaphore(concurrency)
    results: list[tuple[object, float]] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        start = time.perf_counter()
        await asyncio.gather(*[fire_get(client, url, headers, results, sem) for _ in range(total)])
        wall = time.perf_counter() - start
    summarize(name, url, total, concurrency, wall, results)


async def run_login_burst(total: int, concurrency: int):
    sem = asyncio.Semaphore(concurrency)
    results: list[tuple[object, float]] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        start = time.perf_counter()
        await asyncio.gather(*[fire_login(client, results, sem) for _ in range(total)])
        wall = time.perf_counter() - start
    summarize("Rate-limiter enforcement - POST /auth/login (limit: 10/minute)", f"{BASE_URL}/auth/login", total, concurrency, wall, results)

    statuses: dict[object, int] = {}
    for status, _ in results:
        statuses[status] = statuses.get(status, 0) + 1
    got_429 = statuses.get(429, 0)
    print(f"-> {got_429} of {total} requests correctly rejected with 429 once the 10/minute limit was exceeded" if got_429 else "-> WARNING: no 429s seen - rate limiter may not be enforcing")


async def _register_user(client: httpx.AsyncClient) -> str:
    """One throwaway user per upload - avoids every upload racing the same
    account's own state, and means a run can just be re-run without manual
    cleanup. Returns a bearer access token."""
    email = f"stress-test-{uuid.uuid4().hex[:12]}@example.com"
    password = "StressTest123!"
    headers = {"X-Miravelt-API-Key": API_KEY, "Content-Type": "application/json"}
    register = await client.post(f"{BASE_URL}/auth/register", headers=headers, json={"email": email, "password": password})
    register.raise_for_status()
    login = await client.post(f"{BASE_URL}/auth/login", headers=headers, json={"email": email, "password": password})
    login.raise_for_status()
    return login.json()["access_token"]


async def _upload_and_wait(
    client: httpx.AsyncClient,
    results: list,
    sem: asyncio.Semaphore,
    poll_timeout_seconds: float,
):
    async with sem:
        start = time.perf_counter()
        try:
            token = await _register_user(client)
            headers = {"X-Miravelt-API-Key": API_KEY, "Authorization": f"Bearer {token}"}
            with open(MOCK_STATEMENT_PATH, "rb") as f:
                upload = await client.post(
                    f"{BASE_URL}/statements/upload",
                    headers=headers,
                    files={"file": ("gpay_statement.pdf", f, "application/pdf")},
                    data={"keep_original_pdf": "false"},
                )
            if upload.status_code != 202:
                results.append((f"upload_status:{upload.status_code}", time.perf_counter() - start))
                return
            job_id = upload.json()["job_id"]

            deadline = time.perf_counter() + poll_timeout_seconds
            while time.perf_counter() < deadline:
                job = await client.get(f"{BASE_URL}/jobs/{job_id}", headers=headers)
                job.raise_for_status()
                status = job.json()["status"]
                if status in ("COMPLETED", "FAILED"):
                    results.append((status, time.perf_counter() - start))
                    return
                await asyncio.sleep(2.0)
            results.append(("poll_timeout", time.perf_counter() - start))
        except Exception as exc:
            results.append((f"error:{exc.__class__.__name__}", time.perf_counter() - start))


async def run_upload_load_test(total: int, concurrency: int, poll_timeout_seconds: float = 300.0):
    """Real uploads through the real Celery dispatch, each timed start-to-
    finish. NOTE: POST /statements/upload is rate-limited 10/minute *per
    source IP* (core/rate_limiter.py's get_remote_address), not per user -
    running this from one machine means you'll hit that limit well before
    you hit Ollama's real ceiling if `total` is large. Keep `total` modest
    (default below) unless you're also testing from multiple source IPs, or
    you'll mostly be measuring the rate limiter, not processing throughput."""
    sem = asyncio.Semaphore(concurrency)
    results: list[tuple[object, float]] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        start = time.perf_counter()
        await asyncio.gather(*[_upload_and_wait(client, results, sem, poll_timeout_seconds) for _ in range(total)])
        wall = time.perf_counter() - start
    summarize(
        "Real statement uploads, start-to-COMPLETED (through Celery)",
        f"{BASE_URL}/statements/upload",
        total,
        concurrency,
        wall,
        results,
    )
    statuses: dict[object, int] = {}
    for status, _ in results:
        statuses[status] = statuses.get(status, 0) + 1
    print(f"-> {statuses.get('COMPLETED', 0)} of {total} completed successfully "
          f"({statuses.get('FAILED', 0)} failed, {statuses.get('poll_timeout', 0)} timed out waiting)")
    print("-> This is the number to use when sizing STATEMENT_WORKER_CONCURRENCY "
          "(docker-compose_production.yaml) - see HOMELAB_CHECKLIST.md §0.")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-uploads", action="store_true", help="also run the real statement-upload load test (phase 3)")
    parser.add_argument("--upload-total", type=int, default=8, help="number of uploads to run (mind the 10/minute per-IP rate limit)")
    parser.add_argument("--upload-concurrency", type=int, default=4)
    args = parser.parse_args()

    await run_get_batch("Raw throughput - GET /live (unauthenticated)", f"{BASE_URL}/live", {}, TOTAL_REQUESTS, CONCURRENCY)
    await run_get_batch(
        "Raw throughput - GET /health (dependency checks, unauthenticated)",
        f"{BASE_URL}/health",
        {},
        TOTAL_REQUESTS,
        CONCURRENCY,
    )
    await run_login_burst(total=40, concurrency=10)

    if args.with_uploads:
        await run_upload_load_test(args.upload_total, args.upload_concurrency)
    else:
        print("\n(Skipped phase 3 - real statement uploads. Re-run with --with-uploads to measure actual "
              "upload-to-completion throughput before sizing Celery worker concurrency.)")


if __name__ == "__main__":
    asyncio.run(main())
