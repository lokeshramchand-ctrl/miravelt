# Architecture decision records

Short records of the decisions a newcomer is most likely to "fix" by accident. Each says what was
chosen, why, and what would have to be true to revisit it. Newest decisions append; superseded ones
stay, marked as such.

| ADR | Decision |
|---|---|
| [0001](0001-two-keys-plus-jwt.md) | Client key, admin key and per-user JWT are three separate credentials |
| [0002](0002-celery-for-statement-processing.md) | Statement processing runs on Celery, not in the API process |
| [0003](0003-grounding-rule.md) | `/v1/explain` never calls the model without retrieved context |
| [0004](0004-user-timeline.md) | A transaction belongs to the user's timeline, not to one statement |
| [0005](0005-per-user-profiles.md) | Merchant behaviour and memory are per user |
