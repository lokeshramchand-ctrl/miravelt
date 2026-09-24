# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository shape

This repo holds three separate deployables sharing one backend contract:

```
frontend/           Flutter mobile client (the product surface end users touch)
admin-dashboard/     Next.js BFF (server-only) for operator/admin use
<repo root>          FastAPI backend (app.py) - single process, MongoDB + Milvus + Ollama
```

`ARCHITECTURE.md` at the repo root is the authoritative one-level-up map: service boundaries,
who owns what, the non-obvious decisions that must not be "fixed" as a side effect of an
unrelated task, and the exact list of things to stop and ask about before changing. **Read it
before making any cross-cutting change.** `PRD.md` says what the product does and what is shipped
vs. open; `DESIGN_SYSTEM.md` holds the mobile app's tokens, components and UI rules.
`docs/README.md` indexes the full documentation set (architecture, API reference, data model,
phase-by-phase internals, auth, testing, known issues).

## Commands

### Backend (Python / FastAPI, repo root)

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt                      # runtime deps only
pip install -r requirements-training.txt              # add only if running training/finetune.py or training/train.py

cp .env.example .env                                  # fill in MIRAVELT_API_KEY, JWT_SECRET_KEY, EMBED_MODEL, LLM_MODEL, MONGODB_URI, MILVUS_URI

uvicorn app:app --reload --host 0.0.0.0 --port 8000   # run locally (needs Mongo reachable; Milvus/Ollama degrade gracefully if absent)

# Whole stack (Mongo + Milvus + Ollama + backend) in Docker:
docker compose -f docker-compose_local.yaml up --build

pytest test_api.py -v                                 # full suite - requires a live MongoDB at $MONGODB_URI, nothing is mocked
pytest test_api.py -v -k test_categorize_valid_payload # single test
# Run it like CI does: ENFORCE_HTTPS=false (TestClient speaks http://), no ADMIN_API_KEY, and
# ideally MONGODB_DB_NAME pointing at a throwaway DB - app startup fails any in-flight statement
# job in its DB (see ARCHITECTURE.md §3), including a running dev server's.
ENFORCE_HTTPS=false ADMIN_API_KEY= MONGODB_DB_NAME=miravelt_test pytest test_api.py -v
bash scripts/test_pipeline.sh                          # manual curl-driven E2E smoke test against a running server

ruff check .                                           # lint - CI and pre-commit pin ruff 0.16.8; keep both in step
ruff check . --fix
pre-commit run --all-files                             # ruff, gitleaks, trailing-whitespace, etc.
```

The app fails fast at startup if a required env var is missing - `core/config.py`'s `Settings`.
`test_api.py` reads the API key from `settings`, so it works with whatever key the environment
configures. `MIRAVELT_API_KEY` in a real `.env` must not be the `miravelt_test_key_123`
placeholder - that value is public (it's the app's fallback).
No linter/formatter runs automatically on save; `ruff` is the only configured tool
(`pyproject.toml`'s `[tool.ruff]`), and `.pre-commit-config.yaml` also runs `gitleaks` for secret
scanning.

### Admin dashboard (Next.js, `admin-dashboard/`)

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint      # eslint
```

Needs the backend running with `ADMIN_API_KEY` set, and its own `.env.local` (`cp .env.example
.env.local`) with `BACKEND_URL`/`MIRAVELT_API_KEY`/`MIRAVELT_ADMIN_KEY` matching the backend's `.env`
plus a fresh `SESSION_SECRET`. Bootstrap the first admin with `python scripts/create_admin.py
you@example.com` from the repo root - further admins are promoted from the dashboard's Users page.

### Frontend (Flutter, `frontend/`)

```bash
flutter pub get
flutter run --dart-define=MIRAVELT_API_KEY=your-api-key-here
flutter analyze
flutter test
flutter test test/some_test_file.dart   # single test file
flutter build apk --release --dart-define=MIRAVELT_API_KEY=<key from ../.env>
```

Release builds are signed with the upload key named in `frontend/android/key.properties`
(gitignored; the keystore lives outside the repo - see `frontend/AGENTS.md` "Release signing").

`ApiEnvironment` (`lib/core/config/api_environment.dart`) picks `production` vs `local` at
runtime, not build time; override with `--dart-define=MIRAVELT_API_BASE_URL=...` /
`MIRAVELT_LOCAL_API_BASE_URL=...`. `MIRAVELT_API_KEY` is build-time only via `--dart-define` and has no
safe default.

### CI (`.github/workflows/ci.yml`)

Runs, in parallel: `gitleaks` secret scan, `ruff check .`, `pip-audit` against
`requirements.txt`/`requirements-training.txt`, `pytest test_api.py -v` (against a real `mongo:6.0`
service container), and `flutter analyze` + `flutter test` in `frontend/`. A Docker job
(hadolint + `docker build` + Trivy scan) runs after lint/test pass. Match these locally before
opening a PR.

## Backend architecture

`app.py` is a single FastAPI process (one uvicorn worker) - routers, ML engines, and statement
processing all run in-process (`fastapi.BackgroundTasks`). Celery + Redis only schedule the batch
pipelines, and only when `REDIS_URI` is set. Each router in `routers/*.py`
should stay thin (parse → delegate to a service/engine → return); business logic belongs in
`engines/`, `services/`, or the domain's own top-level package.

**Domain packages, each with exactly one home for its responsibility:**

| Area | Lives in |
|---|---|
| Ingestion (raw text/PDF → categorized transaction) | `routers/v1.py`, `statements/`, `engines/rule_engine.py` |
| Merchant resolution (noisy text → canonical merchant) | `services/merchant_resolver.py` |
| Memory/trust state machine (EPHEMERAL→TEMPORARY→PERMANENT→ARCHIVED) | `memory/` |
| Behavioral features, clustering, anomaly/subscription detection | `behaviour/`, `features/`, `clustering/`, `analytics/` |
| Grounded explainability (RAG) | `rag/` (`retriever` → `context_builder` → `generator`) |
| Feedback / active learning | `feedback/` |
| Statement ingestion product surface | `statements/`, `insights/` |
| Statement processing | `routers/statements.py` (upload), `statements/statement_service.py`, `insights/statement_insights.py` |
| Data persistence | `database/mongo.py`, `repositories/` (users, refresh tokens, statements, jobs, transactions, app releases, profiles). `routers/v1.py`, `routers/pipelines.py` and the analytics engines still query `database.mongo.db.<collection>` directly - documented tech debt, not the pattern to copy |
| Vector persistence | `database/milvus.py`, `milvus/`, `embeddings/` |

**Auth is two independent layers, both enforced on nearly every router** (`app.py`'s
`include_router` calls above show which; `/health`, `/live`, `/ready`, `/metrics` are the only
exceptions):
- `X-Miravelt-API-Key` (`core/security.py::validate_api_key`) - identifies "this is the real client
  app." Ships inside every client binary, trivially extractable - never let it gate an
  admin/operator-only endpoint.
- `X-Miravelt-Admin-Key` (`core/security.py::validate_admin_key`) - gates `routers/pipelines.py` and
  `routers/admin.py`. Must never fall back to the client key.
- JWT access/refresh tokens (`core/jwt_auth.py`, `routers/auth.py`) identify the *end user* on top
  of the API key, independently checked.

**Hard invariants** (see `ARCHITECTURE.md` §3/§6/§8 for the full list and what to do if a task
seems to require crossing one):
- `POST /v1/explain` never calls Ollama without grounded retrieved context
  (`rag/retriever.py`'s `NO_CONTEXT_AVAILABLE` short-circuit) - this is the hallucination-prevention
  guarantee, don't route around it.
- No CORS middleware unless `CORS_ORIGINS` is set; only MongoDB gates `/ready`, Milvus/Ollama are
  designed to degrade rather than crash the app.
- Batch pipelines (`behaviour`, `clustering`, `memory/decay_engine`, `graphs`) run manually via
  `/v1/pipelines/*` (admin-key gated) and, with `REDIS_URI` set, on the Celery beat schedule in
  `tasks/celery_app.py` - that is the only scheduler; don't add a second one.
- One backend process per database: startup fails every still-running statement job
  (`app.py::_fail_interrupted_statement_jobs`), which is only safe with a single process.
- No blocking or CPU-heavy work on the event loop - PDF parsing and pymilvus calls go through
  `asyncio.to_thread`.
- Spending views exclude `Income` from `category_breakdown` (it covers credits too).
- Secrets (`MIRAVELT_API_KEY`, `MIRAVELT_ADMIN_KEY`, `JWT_SECRET_KEY`, user tokens) never reach the
  admin-dashboard browser - enforced by that app's `"server-only"` files (`src/lib/backend.ts`,
  `src/lib/session.ts`).

`docs/16-known-issues-tech-debt.md` tracks what's intentionally still open (a retraining-queue
executor needs a task queue, training scripts use synthetic not real data, observability endpoints
are stubs) versus fixed - check it before assuming something odd is a bug to fix.

## Admin dashboard architecture

A BFF, not a second backend: no business logic or direct datastore access, every page/action calls
the FastAPI backend over HTTP from the server. `src/lib/backend.ts` (`adminBackendFetch`/
`adminBackendJson`) attaches credentials server-side; `src/lib/dal.ts`'s `requireAdminSession()` is
the per-request auth check; `src/proxy.ts` (Next 16's `middleware.ts`) refreshes the access token
before expiry. Client components must never fetch the backend directly or hold a credential.

## Frontend architecture

Clean Architecture, feature-first: `lib/features/<feature>/{data,domain,presentation}`. State
management is classic Riverpod (`Provider`/`FutureProvider`/`NotifierProvider`/
`AsyncNotifierProvider`) - not the `@riverpod` code generator, which is unusable here due to an
unresolved `riverpod_generator`/`analyzer` version conflict; don't reintroduce it without
re-solving that. `build.yaml` sets `json_serializable`'s `field_rename: snake` globally to match
the backend's snake_case JSON.
