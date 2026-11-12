# 0002 - Celery for statement processing

**Status:** accepted (supersedes in-process `BackgroundTasks`)

**Decision.** `POST /statements/upload` validates, stores, creates a `Statement` and a `Job`, and
enqueues `process_statement_task` on a dedicated `statements` queue. A worker does the parsing,
categorising, analytics and insight generation.

**Why.** API replicas can then scale and restart without losing or double-running work. `acks_late`
redelivers after a worker crash, `claim_and_mark_running` is an atomic `QUEUED -> RUNNING` guard, and
`sweep_stale_statement_jobs` fails orphans.

**Consequences.** Redis is a hard dependency and gates `/ready`. Celery `beat` must be a singleton.
The task receives ids, never statement text (the text is parked in `statement_texts` and deleted on
completion).

**Revisit when** Redis availability becomes the limiting factor; a Mongo-backed queue would remove
the dependency at the cost of polling.
