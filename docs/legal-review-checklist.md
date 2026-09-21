# Legal & Compliance Readiness Checklist

This is an engineering-side pre-launch checklist, not legal advice. It exists
so whoever operates Auvren (or a lawyer engaged to review it) has one place
listing exactly what's decided, what's implemented, and what's still an open
decision before Auvren is submitted to an app store or opened to real users
beyond a private beta. Cross-reference `frontend/docs/PRIVACY_POLICY.md` /
`TERMS_OF_SERVICE.md` (canonical) and `frontend/lib/features/legal/presentation/legal_documents.dart`
(in-app copy, kept manually in sync with the two documents above).

## What's already implemented (verifiable in code, not just policy)

- Passwords hashed with Argon2id, never logged (`core/security.py`).
- Short-lived JWT access tokens + rotating, single-use refresh tokens
  revoked on reuse (`core/jwt_auth.py`).
- TLS enforced end-to-end: HTTPS-only backend traffic outside local dev
  (`core/middleware.py::HTTPSEnforcementMiddleware`), TLS required for the
  MongoDB connection (`database/mongo.py`).
- Per-statement deletion, self-service (`Manage periods` in the app) —
  actually removes the PDF, transactions, and processing history.
- CSV export of a user's own transaction data (`Profile → Export my data`).
- No third-party analytics/crash-reporting SDK, no ad identifiers, no
  location/contacts/camera/microphone access anywhere in `frontend/`.
- No third-party AI API: categorization/explanation inference runs on a
  self-hosted Ollama instance (`core/ollama_client.py`), not sent to
  OpenAI/Anthropic/Google/etc.
- Data-breach notification commitment (added to both documents).

## Open decisions — need you (or a lawyer), not more code

These are explicitly **not** things an engineering pass can resolve, because
they're facts about the business, not the software:

- [ ] **Contact email.** Both documents list `lokeshramchand@gmail` —
      that's missing a domain (`.com`? something else?) and is currently
      not a deliverable address. This is the address users are told to
      email for account deletion requests and policy questions — it needs
      to be correct before this is usable, let alone published. **Confirm
      the real address and I'll update both files + the in-app copy.**
- [ ] **Governing law / jurisdiction.** `TERMS_OF_SERVICE.md`'s "Governing
      law" section is an explicit placeholder
      (`[GOVERNING LAW / JURISDICTION TBD]`). Given the product is built
      around Google Pay/UPI statements (India-specific), India's
      **Digital Personal Data Protection Act, 2023 (DPDP Act)** is the
      most likely applicable data-protection framework, and Indian
      contract law the likely default for the Terms — but this is a real
      decision with liability implications, not something to default to
      silently in code.
- [ ] **Legal entity.** Currently "developed by an individual developer,
      not a registered company." Decide whether to register a business
      entity before public launch — affects liability exposure, the
      Terms' limitation-of-liability section, and potentially app-store
      developer-account requirements (Google Play requires business
      verification for some account types).
- [ ] **Formal legal review.** Both documents are explicitly marked
      `Status: draft, not yet reviewed by a lawyer`. That flag should stay
      until an actual review happens — don't remove it as part of any
      "polish" pass; only remove it once true.
- [ ] **Grievance Officer.** If DPDP Act applicability is confirmed above,
      India's IT Rules / DPDP framework expects a named grievance contact
      for data-protection complaints, distinct from general support email.

## App-store submission requirements (once the above is settled)

- [ ] **Google Play Data Safety form** must accurately mirror what
      `PRIVACY_POLICY.md`'s "What data we collect" section says is
      collected — email, statement PDFs, parsed transaction fields,
      category corrections. Mismatches between the form and the actual
      app are a common rejection/removal reason.
- [ ] **Apple App Store privacy "nutrition label"** — same requirement,
      Apple's format.
- [ ] **`android/app/build.gradle.kts` still signs release builds with the
      debug keystore** (flagged in `frontend/CLAUDE.md`) — not a legal
      issue, but a hard blocker for any store submission; listed here so
      it isn't missed alongside the legal items above.
- [ ] Confirm whether Google's API/branding usage (parsing "Google Pay"
      statements) requires any trademark/fair-use disclaimer beyond what
      `TERMS_OF_SERVICE.md`'s "What Auvren is (and isn't)" section already
      states (Auvren is not affiliated with Google Pay).

## What NOT to do

- Don't invent a jurisdiction, entity name, or contact address to make the
  documents "look complete" — a wrong governing-law clause or an
  undeliverable contact address is worse than an honest placeholder.
- Don't remove the "not yet reviewed by a lawyer" status line until a
  lawyer has actually reviewed it.
- Don't let the in-app copy (`legal_documents.dart`) drift from the
  canonical Markdown files — update both together, per the comment at the
  top of `legal_documents.dart`.
