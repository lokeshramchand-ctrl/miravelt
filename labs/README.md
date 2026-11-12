# labs/

Code that works on its own but that **no screen in the app reads**. It lives here so the main tree
is honest: if a module is outside `labs/`, a user can reach it.

Nothing in `labs/` is mounted or scheduled unless `LABS_ENABLED=true`. The test suite turns it on
(root `conftest.py`) so the experiments keep passing their tests while they wait.

| Part | What it does | Reads / writes | What promotion needs |
|---|---|---|---|
| `clustering/` | UMAP + HDBSCAN over behaviour vectors in Milvus | `behavior_patterns`, Milvus | A screen that shows a cluster to a user, and per-user vectors (today's are one collection for everyone) |
| `graphs/` | In-memory merchant knowledge graph | `transactions` | A consumer. Nothing asks the graph a question |
| `training/`, `evaluation/` | LightGBM/XGBoost baseline and LoRA fine-tune, with model metrics | synthetic data (`train.py::load_data`) | Real labelled data. `scripts/eval_categorizer.py` and the corrections log are the start of that set |
| `retraining_queue.py`, `retraining_tasks.py` | Triggers the baseline trainer after N corrections | `retraining_queue` | The trainer above training on real data. Scheduling a job that trains on random data was worse than not scheduling it |
| `memory/`, `profile_repository.py`, `routers/memory.py` | Global merchant profiles with the EPHEMERAL → PERMANENT state machine and a decay sweep | `merchant_profiles` | Nothing: superseded by the per-user memory in `repositories/memory_repository.py`, which reuses `memory/state_machine.py` |
| `merchant_resolver.py` | Noisy text → canonical merchant via the `merchants` collection | `merchants` (seed script only) | A populated `merchants` collection. Statement categorisation uses `engines/categorizer.py` |
| `confidence_engine.py` | Forces a prediction to Unknown below a confidence wall | - | A model whose confidence needs gating. The categoriser's sources carry fixed confidences |
| `routers/observability.py` | Drift endpoints that return fixed responses | - | A real drift job. Request metrics are served by `/metrics` |
| `input_validation.py`, `request_signing.py` | Generic validators and an HMAC request-signing verifier | - | A caller. Pydantic models validate input; requests are authenticated by API key + JWT |

## Endpoints mounted when enabled

`/memory/*`, `/v1/resolve`, `/v1/confidence/evaluate`, `/v1/observability/*`,
`/v1/pipelines/decay/sweep`, `/v1/pipelines/graph/*`, `/v1/pipelines/clustering/run`.
The pipeline routes keep their admin-key gate.

## Scheduled jobs added when enabled

Embeddings sync, decay sweep, graph build, clustering, retraining check
(`labs/schedule.py`).

## Promoting something

Move it back into the main tree in the same change that adds the screen or endpoint that uses it,
and delete its row above.
