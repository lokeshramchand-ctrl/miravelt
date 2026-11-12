# 0005 - Per-user behaviour and memory

**Status:** accepted (closes PROJECT_AUDIT F5; the core of SECURITY_AUDIT C-3)

**Decision.** Behaviour profiles, recurring detection and merchant memory are keyed by
`(user_id, merchant)`. Categorisation consults this user's corrections first. A community alias is
promoted only when `COMMUNITY_ALIAS_MIN_USERS` distinct users agree, and never for a counterparty
classified as a person.

**Why.** Pooling every user's timestamps for a merchant made recurring detection fall apart as users
were added (0.96 for one payer, 0.0 for forty), and shared private payees across accounts.

**Consequences.** Old global collections were rebuilt (`database/migrations.py`). The earlier
global memory state machine lives in `labs/` and is superseded by `repositories/memory_repository.py`.

**Revisit when** a k-anonymous, opt-in business table is wanted for cold-start suggestions.
