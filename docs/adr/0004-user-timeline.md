# 0004 - One timeline per user

**Status:** accepted (closes PROJECT_AUDIT F1, F10 and most of F8)

**Decision.** A transaction belongs to the user, keyed `(user_id, reference_number)`. A statement is a
source: each row lists `source_statement_ids`. A period is the set of rows its statement vouches for.
Re-uploading or overlapping statements merge; deleting a statement removes only rows no other
statement vouches for. "Previous period" orders by `period_start`. A content hash short-circuits an
identical re-upload. Days and months are computed in `core/timezone.py`'s `APP_TZ`.

**Why.** Real statements overlap, get downloaded twice and arrive out of order. Owning rows by
statement made the earlier period lose data.

**Consequences.** A user's category correction survives a merge. Analytics are persisted per
statement and recomputed (`statements/recompute.py`) when a merge or correction changes a period.

**Revisit when** periods stop being statement-shaped (bank feeds).
