# Homelab / Coolify Deployment Checklist

Operational checklist for running this backend in the self-hosted homelab (Coolify, public IP,
Ollama and the databases already running there). This is a **todo list for the operator**, not
architecture documentation — see `ARCHITECTURE.md` for how the system is built and why. Written
against the state of the repo after statement processing moved onto Celery/Redis (see
`docs/16-known-issues-tech-debt.md`) — re-check this file if that changes again.

## 0. Before touching Coolify

- [ ] Load-test first, don't guess a number: run `scripts/stress_test.py` against the real
      homelab box (not this sandbox) to see actual throughput on `/live`/`/health`, then do a
      real statement upload under concurrency and time how long Ollama actually takes per
      insight generation. Every concurrency number below is a *starting* default, not a verified
      ceiling — the GPU-backed Ollama instance is the real bottleneck, not FastAPI.
- [ ] Confirm the exact homelab box specs you're deploying onto (CPU cores, RAM, GPU VRAM) so the
      `deploy.resources` blocks in `docker-compose_production.yaml` reflect reality, not the
      placeholder defaults already in the file.

## 1. Services to run in Coolify

This repo's `docker-compose_production.yaml` defines everything Coolify needs to manage as one
application:

| Service | Role | Replicas |
|---|---|---|
| `miravelt-backend` | FastAPI API | **Now safe to run >1** — statement processing no longer runs in this process (`tasks/statement_tasks.py`), so the old "exactly one process" constraint is gone. Start with 2 behind Coolify's proxy once load-tested. |
| `miravelt-celery-worker` | Batch pipelines + retraining, queue `celery` | 1 is fine to start; pipelines run on a schedule (hours), not per-request. |
| `miravelt-celery-worker-statements` | Statement processing, queue `statements` | On the critical path for every upload now. `STATEMENT_WORKER_CONCURRENCY` env var controls concurrency — tune against real Ollama throughput (§0). |
| `miravelt-celery-beat` | The one scheduler | **Must stay exactly 1 replica, always.** Running two means every scheduled job (pipelines, the stale-job sweep, retraining check) fires twice. Coolify's "replicas" setting for this specific service must never be touched. |

MongoDB, Milvus, Ollama, and Redis are **not** in `docker-compose_production.yaml` — per the
comments in that file, production points at externally-managed instances (your homelab's
existing Mongo/Milvus/Ollama/Redis), not compose-local containers. Confirm each is reachable from
wherever Coolify schedules these four services (same Docker network / host networking / Tailscale,
whatever your homelab uses) before first deploy.

## 2. Environment variables / secrets (Coolify's secret store, never in git)

Required (app fails to start / `docker-compose`'s `:?` fails without these):

```
MONGODB_URI, MILVUS_URI, EMBED_MODEL, LLM_MODEL, MIRAVELT_API_KEY, JWT_SECRET_KEY, REDIS_URI
```

`REDIS_URI` is **newly required** as of this change — it used to be optional (caching/rate-limit
only). Statement upload now dispatches via Celery and will `503` without a reachable broker, so
treat Redis with the same seriousness as Mongo from here on.

Strongly recommended, not enforced by a startup check:

- `ADMIN_API_KEY` — gates `routers/admin.py` and `routers/pipelines.py`. Leave unset and those
  404/503 rather than silently falling back to `MIRAVELT_API_KEY` (never let that fallback happen —
  `MIRAVELT_API_KEY` ships inside the mobile app binary and is trivially extractable).
- `STATEMENT_WORKER_CONCURRENCY` — defaults to 2 in the compose file; set explicitly once you've
  load-tested (§0).
- `MONGODB_MAX_POOL_SIZE` — defaults to 50 per backend/worker process. With N backend replicas +
  2 worker types, total simultaneous Mongo connections ≈ `(replicas + 2) × pool_size` — make sure
  your Mongo instance's own connection limit comfortably exceeds that.

Bootstrap the first admin account once, from a shell with access to the deployed Mongo:
`python scripts/create_admin.py you@example.com` (repo root) — there is deliberately no self-serve
"become admin" endpoint.

## 3. Networking / public-IP exposure

This is the part that actually matters with a public IP attached to homelab hardware:

- [ ] **Only `miravelt-backend`'s port should ever be reachable from the public IP.** MongoDB,
      Milvus, Ollama, and Redis must be reachable *only* on the internal/private network Coolify's
      containers share — never port-forwarded on the router, never bound to a public interface.
- [ ] Coolify's built-in Traefik handles TLS (Let's Encrypt) for the backend's public domain —
      confirm `ENFORCE_HTTPS=true` (the default) and that the certificate is actually issued and
      auto-renewing, not just configured.
- [ ] `CORS_ORIGINS` stays **unset** unless a browser-based client calls this API directly (the
      mobile app doesn't need it). If the admin dashboard ever calls the backend straight from the
      browser instead of through its Next.js BFF, that would be the one legitimate reason to set
      it — don't set it "just in case."
- [ ] Put *some* request-rate protection in front of the public IP beyond this app's own
      `slowapi` limits (`core/rate_limiter.py`) — Coolify/Traefik rate limiting, or fail2ban at the
      host level, since a public IP on home internet is a real abuse target in a way a cloud LB
      behind a CDN usually isn't.
- [ ] Confirm the homelab's router/firewall doesn't expose SSH, the Mongo/Milvus/Ollama ports, or
      Coolify's own management UI to the public IP — only the reverse-proxied app port should be
      forwarded.

## 4. Health checks

Wire Coolify's health check for `miravelt-backend` to `GET /ready`, not `/live`:

- `/live` — process is alive, no dependency checks. Use for Coolify's "is the container running"
  liveness probe only.
- `/ready` — gates on **MongoDB and Redis** both being reachable (Milvus/Ollama degrade
  gracefully and don't gate this). This is the one that should control whether Coolify sends
  traffic to a given backend replica.
- `/health` — full status including Milvus/Ollama, informational only, good for a Grafana/uptime
  dashboard, not for load-balancer gating.

## 5. Backups

Nothing in this repo does automated backups — that's entirely an operator/homelab responsibility:

- [ ] Mongo: scheduled `mongodump` (cron, or Coolify's own backup feature if the self-hosted Mongo
      is also Coolify-managed) covering every database this app uses, including GridFS chunks
      (`statement_repository.py::store_pdf`) if `keep_original_pdf` is used by any user.
- [ ] Milvus: volume snapshot of its data directory — losing it just means re-running
      `POST /v1/pipelines/embeddings/sync` to rebuild, so this is lower priority than Mongo, but
      still worth having.
- [ ] **Actually test a restore**, not just that the backup job exits 0. A backup nobody has ever
      restored from is a hope, not a backup.
- [ ] Redis needs no backup for this app's usage (cache + broker, nothing here is the system of
      record for Redis-held state) — a lost Celery queue just means in-flight uploads need
      re-uploading, acceptable.

## 6. Monitoring / observability

- [ ] `GET /metrics` (Prometheus format, `prometheus-fastapi-instrumentator`) is already wired —
      point a Prometheus instance at it if you run one in the homelab already.
- [ ] Celery queue depth/worker health has no built-in UI here. Consider adding a `flower`
      service (official Celery monitoring UI) pointed at the same `REDIS_URI` if you want visibility
      into queue backlog — optional, not required for correctness, just for noticing a stuck queue
      before a user complains.
- [ ] Watch disk space on the Mongo/Milvus volumes and GPU memory/utilization on the Ollama box —
      none of this app's own code monitors host resources.
- [ ] `PDF_RETENTION_DAYS` (default 90) only actually deletes anything if the decay/retention
      pipeline runs on schedule — confirm `miravelt-celery-beat` is up and its `retention/cleanup`
      schedule is firing (check `/admin/jobs` or logs), not just that the setting exists.

## 7. Rollout / updates

- [ ] `miravelt-backend` can now be rolled/restarted one replica at a time safely (the old
      single-process constraint is gone) — use Coolify's rolling restart rather than taking the
      whole app down.
- [ ] `miravelt-celery-worker` / `miravelt-celery-worker-statements`: Celery's default is to let a
      worker finish its current task on `SIGTERM` before exiting — make sure Coolify's stop grace
      period is long enough to cover a real statement job (several minutes, not Docker's default
      10s) or an in-flight job gets killed and has to wait for the stale-job sweep
      (`STATEMENT_STALE_JOB_TIMEOUT_MINUTES`, default 20 min) to recover it.
- [ ] `miravelt-celery-beat`: restart it too, but never scale it — see §1's warning.
- [ ] CI (`.github/workflows/ci.yml`) already triggers a Coolify webhook on `main` (staging) and on
      a `vX.Y.Z` tag (production, gated by a required-reviewers GitHub Environment) — confirm
      `COOLIFY_STAGING_WEBHOOK_URL` / `COOLIFY_PRODUCTION_WEBHOOK_URL` are actually set as repo
      secrets; until they are, CI silently skips the deploy trigger rather than failing.

## 8. Secrets hygiene

- `MIRAVELT_API_KEY`, `ADMIN_API_KEY`, `JWT_SECRET_KEY`, and the Mongo/Redis connection strings
  live only in Coolify's secret store / environment config — never committed, never echoed into
  Coolify build logs.
- Rotate `JWT_SECRET_KEY` only with awareness it invalidates every existing session (every issued
  token fails signature verification afterward) — plan it as a deliberate, communicated action,
  not a routine rotation.
- The admin dashboard (if also deployed) never holds any of these in the browser — see its own
  `CLAUDE.md`'s `"server-only"` guarantee. Don't "simplify" that by moving a credential into a
  client component to save a round trip.

## 9. First-deploy smoke test

Once the above is live, confirm end-to-end before calling it done:

1. `GET /live` and `GET /ready` both `200` from the public domain.
2. Register a real test account, upload a real Google Pay statement PDF, confirm `GET /jobs/{id}`
   reaches `COMPLETED` (proves the `statements` queue worker is actually consuming tasks, not just
   that the API accepted the upload).
3. Trigger one pipeline manually (`POST /v1/pipelines/behavior/run-all`, admin-key gated) and
   confirm it completes — proves the `celery` queue worker is also alive.
4. Check `miravelt-celery-beat` logs show the scheduled tasks actually firing on their intervals,
   not just that the process is up.
