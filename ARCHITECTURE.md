# Architecture

This is the one-level-up map. For line-level detail, see `docs/` (`01-architecture.md` for full request-flow diagrams, `16-known-issues-tech-debt.md` for what's fixed vs. still open, `22-authentication.md` for the auth model). This file exists so an agent doesn't have to re-derive intent from scratch or "fix" a decision that was made on purpose.

## 1. What's in the system

Two deployables, one shared backend contract:

```
Flutter app (frontend/)   ─┐
                            ├─ X-Miravelt-API-Key + JWT ──▶  FastAPI monolith (app.py)  ──▶  MongoDB (system of record)
Next.js admin-dashboard   ─┘  (BFF, server-only)                  │                  ──▶  Milvus (vector search)
                                                                    └────────────────  ──▶  Ollama (embeddings + LLM generation)
```

- **`app.py`** is a single FastAPI process (one uvicorn worker) — routers, ML engines, and statement processing all run in the same Python process, same container. Statement processing runs via `fastapi.BackgroundTasks` in-process. Celery + Redis exist only for the *batch* pipelines' schedule, and only when `REDIS_URI` is set (§3); they never run statement processing.
- **`admin-dashboard/`** is a separate Next.js app acting as a **BFF (backend-for-frontend)**, not a second backend. It holds no business logic and no direct datastore access — every page/action calls the FastAPI backend over HTTP.
- **`frontend/`** is the Flutter mobile client, the actual product surface end users touch.
- **MongoDB** is the one hard dependency — `/ready` fails without it. **Milvus** and **Ollama** degrade specific features (RAG, embeddings) gracefully rather than failing the app (`app.py`'s `_check_dependencies`).

## 2. Who's responsible for what

| Area | Owns | Lives in |
|---|---|---|
| Ingestion | Raw text/PDF → categorized transaction | `routers/v1.py`, `statements/`, `engines/rule_engine.py` |
| Merchant resolution | Noisy bank/UPI text → canonical merchant | `services/merchant_resolver.py` |
| Memory / trust | Merchant familiarity state (EPHEMERAL→TEMPORARY→PERMANENT→ARCHIVED) | `memory/` |
| Behavioral intelligence | Feature extraction, clustering, anomaly/subscription detection | `behaviour/`, `features/`, `clustering/`, `analytics/` |
| Explainability | Grounded RAG over a transaction's history — never freeform LLM guessing | `rag/` (`retriever` → `context_builder` → `generator`) |
| Feedback / active learning | User corrections, retraining queue | `feedback/` |
| Auth (app-level) | `X-Miravelt-API-Key` — authenticates the *calling application* | `core/security.py` |
| Auth (user-level) | JWT access/refresh tokens — authenticates the *end user* | `core/jwt_auth.py`, `routers/auth.py` |
| Auth (admin-level) | `X-Miravelt-Admin-Key` — gates operator-only batch jobs & releases | `core/security.py::validate_admin_key`, `routers/admin.py`, `routers/pipelines.py` |
| Admin dashboard session | Iron-session cookie holding the operator's JWT, server-side only | `admin-dashboard/src/lib/session.ts`, `dal.ts` |
| Data persistence | MongoDB collections, connection lifecycle | `database/mongo.py`, `repositories/` |
| Statement processing | PDF → transactions → analytics → insights, job progress | `routers/statements.py` (upload), `statements/statement_service.py`, `insights/`, `repositories/job_repository.py` |
| Mobile session & routing | Launch splash, auth/period-driven redirects, backend selection | `frontend/lib/core/routing/app_router.dart`, `features/auth/`, `features/developer/` |
| Vector persistence | Milvus collections, embeddings | `database/milvus.py`, `milvus/`, `embeddings/` |

Each of these has exactly one home. If you find yourself duplicating merchant resolution logic, a state-machine transition, or a Mongo query pattern in a second place, that's a signal the boundary is being violated, not that a new variant is needed.

## 3. Why it's built this way (non-obvious decisions — don't "fix" these)

- **Two auth keys, not one.** `MIRAVELT_API_KEY` ships inside every client app binary and is trivially extractable — it authenticates "this is the real app," nothing more. `ADMIN_API_KEY` gates `routers/pipelines.py` and release publishing precisely *because* it must never be reachable by anything holding only the client key. Don't collapse these, and don't let `ADMIN_API_KEY` fall back to `MIRAVELT_API_KEY` (`core/config.py` comment is explicit about this).
- **Every router still requires `X-Miravelt-API-Key` even when a JWT is also required.** The two checks are independent and both enforced — a valid JWT without the API key is rejected before the handler runs. This is intentional defense-in-depth, not redundancy to remove.
- **No CORS middleware unless `CORS_ORIGINS` is set.** Closed-by-default, same posture as the API key. It only got turned on once the admin dashboard (a browser client) needed to call the API directly — the mobile app never needed it.
- **Liveness vs. readiness are split** so a hung Mongo/Milvus/Ollama dependency never fails liveness and triggers a restart-loop that won't fix anything. Only MongoDB gates `/ready`; Milvus/Ollama don't, because those features are designed to degrade, not crash the app.
- **`/v1/explain` refuses to call Ollama with no retrieved context** (`rag/retriever.py` → `"NO_CONTEXT_AVAILABLE"` short-circuit). This is the system's core hallucination-prevention guarantee — never route around it by letting the generator run on empty context "just to return something."
- **Batch pipelines (`behaviour`, `clustering`, `memory/decay_engine`, `graphs`) are reachable both manually (`/v1/pipelines/*`) and on a schedule.** `tasks/celery_app.py` + `tasks/pipeline_tasks.py` run the same engine functions on a beat schedule (`core/config.py`'s `PIPELINE_*_INTERVAL_MINUTES`) via a Celery worker/beat process pair — see `docker-compose_local.yaml`'s `celery-worker`/`celery-beat` services. This requires `REDIS_URI` to be set; unset, everything degrades to manual-trigger-only, same as before. Still don't add a *second* scheduling mechanism (e.g. APScheduler, a raw cron entry calling the API) — this is now the one home for it, matching §2's "each responsibility has exactly one home."
- **Repositories exist for users, refresh tokens, statements, jobs, transactions, app releases and merchant profiles** (`repositories/`). A few places still query `database.mongo.db.<collection>` directly — `routers/v1.py`, `routers/pipelines.py`, and the analytics/behaviour engines' aggregation pipelines. That is documented tech debt, not a pattern to copy: new persistent-state work goes through a repository.
- **Statement processing is in-process, so startup fails orphaned jobs.** A restart kills whatever `BackgroundTasks` job was running while its document still says RUNNING. `app.py::_fail_interrupted_statement_jobs` marks every QUEUED/RUNNING statement job (and its statement) FAILED at startup. This is only correct while **exactly one backend process uses a given database** — a second uvicorn worker, or a test run pointed at a live dev database, would fail the other process's in-flight jobs. Moving processing onto a real queue removes the constraint.
- **Synchronous work never runs on the event loop.** pdfplumber extraction in the upload handler, transaction parsing in the pipeline, and the blocking pymilvus client all go through `asyncio.to_thread`. On a single-process server a few seconds of CPU on the loop freezes every other request (measured: a `/live` probe waited 35.9s during an upload).
- **Statement insights never come back empty because the LLM failed.** `insights/statement_insights.py` asks Ollama first and falls back to deterministic insights computed from the persisted analytics — same grounding rule, no invented figures.
- **`category_breakdown` includes Income on purpose** (`docs/23-statements-pipeline.md`). Every "where the money went" / "% of spending" view must exclude it — the app uses `StatementAnalytics.spendingBreakdown` — or shares exceed 100%.
- **Periodicity counts distinct timestamps.** `behavior_patterns` pools a merchant's transactions across all statements and users, so re-uploaded statements produce identical timestamps; `features/periodicity.py` de-duplicates them, and a statement's recurring payments also need 3+ occurrences within that statement.
- **Categorisation confidence is stored on each transaction** (0.95 alias match, 0.6 business keyword, 0.0 unmatched, 1.0 user correction, `None` for credits) so the app can say how a category was decided rather than implying certainty.
- **The admin dashboard never holds `MIRAVELT_API_KEY`, `MIRAVELT_ADMIN_KEY`, or a raw access token in the browser.** Every credential lives server-side in `admin-dashboard/src/lib/backend.ts`/`session.ts` (`"server-only"` guard at the top of both). This is the entire reason the BFF exists instead of the dashboard calling the backend straight from client components.

## 4. What's allowed to touch what

```
Client (Flutter / admin-dashboard browser)
        │  HTTPS, never holds backend secrets
        ▼
Next.js Server Actions / Route Handlers  (admin-dashboard only — BFF layer)
        │  attaches X-Miravelt-API-Key / X-Miravelt-Admin-Key / Bearer JWT server-side
        ▼
FastAPI routers (routers/*.py)           — thin: parse input → call one domain function → return
        │
        ▼
Services / Engines / Repositories        (engines/, services/, memory/, analytics/, rag/, repositories/)
        │
        ▼
Datastores (MongoDB, Milvus) / Ollama
```

Explicitly banned:
- **The admin-dashboard UI (client components) must never see a backend secret or raw JWT.** Everything credentialed goes through a Server Action / Route Handler (`"server-only"` files).
- **Routers must never talk to MongoDB/Milvus directly for anything beyond what's already the norm here** — prefer a repository or existing service. (`routers/v1.py::categorize_transaction` inlining a Mongo write is documented tech debt, not a pattern to copy.)
- **No new business logic in a router.** Routers parse, delegate, return. If a handler is doing regex extraction, aggregation logic, or multi-step orchestration inline, that belongs in a service/engine.
- **Client app secrets (`MIRAVELT_API_KEY`) must never gate operator-only/system-wide endpoints** (batch pipelines, release publishing). Those require `ADMIN_API_KEY` on top.
- **`rag/generator.py` must never be called without a grounded context payload.** No context → return the "no historical behavior found" response, don't call the LLM.

## 5. How data actually moves (representative flows)

**Statement ingestion (the primary product surface):**
`POST /statements/upload` → `statements/pdf_parser.py` validates/decrypts on a worker thread (fails fast, 422) → PDF stored in GridFS unless `keep_original_pdf=false` → `Statement(PENDING)` + `Job(QUEUED)` created, `202` returned → `BackgroundTasks` runs `statements/statement_service.py`: parse → categorize (`engines/rule_engine.py`: merchant alias, else business keyword, else Uncategorized) → persist transactions → refresh merchant behaviour profiles (`behaviour/behavior_engine.py`) → embed + write to Milvus → compute analytics → generate insights (Ollama, else computed) → mark `Job` `COMPLETED`. Client polls `GET /jobs/{id}`; a restart fails the job cleanly (§3).

**Mobile app launch and sign-in:**
The router starts on `/splash` and holds there while `AuthController` checks the stored session. `periodsProvider` is keyed on the signed-in user id, so each sign-in fetches that user's periods, and the router waits for that result before choosing Overview (has periods) or onboarding (none). Onboarding only redirects to Overview once a period has *completed*, so a first upload can reach the Analysing screen. Switching backend in Developer settings signs out against the old backend first, so a session is never sent to the new host.

**Admin dashboard write (e.g. changing a user's role):**
Browser submits a form → Next.js Server Action (`admin-dashboard/src/app/dashboard/users/actions.ts`) → `adminBackendFetch` attaches `Bearer <session JWT>` + `X-Miravelt-Admin-Key` (both read server-side from the iron-session cookie / env, never sent to the browser) → `routers/admin.py` → repository/service → MongoDB → Server Action revalidates the page.

**Explainability:**
`POST /v1/explain` → `rag/retriever.py` embeds the query via Ollama → searches Milvus for similar behaviors → pulls merchant profile + behavior pattern + recent feedback from MongoDB per match → `rag/context_builder.py` assembles an XML-tagged prompt → `rag/generator.py` calls Ollama `/api/generate` → parsed JSON returned. Zero Milvus hits short-circuits before ever reaching Ollama.

Full sequence diagrams for these and every other endpoint: `docs/01-architecture.md`.

## 6. What can never break

- **Secrets stay server-side.** `MIRAVELT_API_KEY`, `MIRAVELT_ADMIN_KEY`, `JWT_SECRET_KEY`, and any user's access/refresh token never reach a browser or client-side bundle. The admin dashboard's `"server-only"` files are the enforcement point — don't move logic out of them to "simplify" a component.
- **The API-key layer runs before any handler, unconditionally.** Every router except `/health`, `/live`, `/ready`, `/metrics` requires `X-Miravelt-API-Key` at the router level, regardless of what a specific handler additionally requires.
- **`/v1/explain` never hallucinates on empty context.** See §3.
- **Every domain responsibility has one home** (§2). Don't create a second merchant-resolution path, a second state-machine, or a second error-response shape.
- **Error responses go through `core/error_handlers.py`'s registered handlers**, not ad-hoc `JSONResponse`/raw dict shapes in a new handler — the codebase already has real inconsistency here; don't add a fourth shape.
- **No credential or connection string gets committed to a compose file or source** — use `${VAR:?required}` substitution (`docker-compose_production.yaml` is the reference pattern).
- **Boundaries in §4 don't get quietly crossed** to save a round trip. If a task seems to require crossing one, that's a signal to stop (§8), not a green light.

## 7. Where new code belongs

- **New API endpoint** → add a handler to the relevant `routers/*.py` (or a new router if it's a genuinely new domain), mounted in `app.py` with `Depends(validate_api_key)` at minimum. Keep the handler thin — delegate to a service/engine.
- **New business logic / domain rule** → a service or engine, matching the existing shape of the domain it's closest to (`engines/` for deterministic rule-based logic, `services/` for resolution-style lookups, the domain's own top-level folder — `memory/`, `analytics/`, `rag/` — for anything domain-specific). Don't invent a sixth naming convention; reuse `Engine`/`Resolver`/`Manager`/`Analyzer`/`Builder` as already established.
- **New persistent data access** → a repository under `repositories/`, following `profile_repository.py`'s shape (typed interface hiding Mongo specifics), even though most existing collections don't have one yet. Don't add a new direct `db.<collection>` access site if a repository can be added or extended instead.
- **New batch/offline pipeline** → its own module (matching `behaviour/`, `clustering/`, `graphs/` shape) exposed via `routers/pipelines.py` with `validate_admin_key`, and (optionally) a matching task in `tasks/pipeline_tasks.py` + an entry in `tasks/celery_app.py`'s `beat_schedule` if it should run automatically (see §3) — don't invent a second scheduling mechanism for it.
- **New expensive read endpoint** → consider `core/cache.py`'s `@cached` decorator (cache-aside, Redis-backed, degrades to a no-op without `REDIS_URI`) if it's a per-user aggregation where a short TTL's staleness is acceptable — see `routers/analytics.py` for the pattern. Never cache anything on the write path, or anything whose correctness (not just latency) depends on being current, like `/v1/explain`'s retrieved context.
- **New admin-dashboard page/action** → a Server Component for reads (via `dal.ts`) and a Server Action for writes (via `backend.ts`'s `adminBackendFetch`/`adminBackendJson`). Never fetch the backend from a client component.
- **New config value** → `core/config.py`'s `Settings`, with a safe default or explicit `required` semantics matching the existing fail-fast posture — not a scattered `os.getenv` call.

## 8. When to stop and ask

Stop and name the conflict, show what it affects, and propose the smallest fix that doesn't break the rule, if a task would:

- Route around the `/v1/explain` no-context guard, or otherwise let an LLM generate without grounded retrieval.
- Let `MIRAVELT_API_KEY` (or any client-embedded secret) gate an admin/operator-only or system-wide endpoint.
- Introduce a second data-access path for a collection that already has (or should get) a repository.
- Add business logic directly inside a router handler, or inside an admin-dashboard client component.
- Introduce a new background-job/scheduling mechanism as a side effect of an unrelated feature (this is a real infra decision the repo has explicitly deferred — see `docs/16-known-issues-tech-debt.md` §16.5).
- Send a backend secret, admin key, or raw JWT to the browser in the admin dashboard.
- Change the two-key auth model (client key vs. admin key vs. per-user JWT) in a way that collapses the distinction in §3.
- Run more than one backend process against the same database (extra uvicorn workers, a second replica) — the startup job sweep (§3) assumes one.
- Put blocking or CPU-heavy work directly in an `async` handler or pipeline step instead of `asyncio.to_thread`.

## Related documents

- `docs/01-architecture.md` — full request/sequence diagrams per endpoint
- `docs/16-known-issues-tech-debt.md` — what's fixed vs. intentionally still open
- `docs/22-authentication.md` — full auth/token lifecycle
- `docs/23-statements-pipeline.md` — statement ingestion pipeline detail
- `PRD.md` — what the product does and what's shipped vs. open
- `DESIGN_SYSTEM.md` — the mobile app's tokens, components and rules
- `admin-dashboard/README.md` — dashboard-specific conventions
