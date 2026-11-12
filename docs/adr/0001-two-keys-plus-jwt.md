# 0001 - Client key, admin key and per-user JWT

**Status:** accepted

**Decision.** `X-Miravelt-API-Key` says "this is the real app". `X-Miravelt-Admin-Key` gates
operator routes. A JWT (15-minute access, rotating 30-day refresh) says which user is asking. All
three are checked independently; none falls back to another.

**Why.** The client key ships in every APK and can be extracted in minutes, so it can never protect
anything that matters. The admin key stays on the admin dashboard's server (`server-only` files).
User identity needs its own revocable credential.

**Consequences.** Ownership failures return 404, not 403, so ids cannot be probed. Refresh tokens are
single-use; a reused token revokes the family (a short grace window covers a lost response).

**Revisit when** device attestation replaces the shared client key (SECURITY_AUDIT M-10).
