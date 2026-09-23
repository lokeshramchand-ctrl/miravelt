# Product Requirements - Miravelt

**Status:** pre-production. The backend, mobile app and admin dashboard are built and run on a
local Docker stack. No production deployment exists yet.
**Owner:** product/engineering (single team). **Last updated:** 2026-09-23.

Related: `ARCHITECTURE.md` (how it's built), `DESIGN_SYSTEM.md` (how it looks),
`frontend/docs/DESIGN_SPEC.md` (screen-by-screen design), `docs/` (engineering reference).

---

## 1. Problem

People who pay mostly through UPI (Google Pay in particular) have a complete record of their
spending, but only as a long PDF of "Paid to X / Received from Y" lines. It answers "what
happened", never "what does it mean": where the money went, what changed, what repeats, and what
is unusual. Budgeting apps that could answer that usually want bank-account or card access, which
many users won't give.

## 2. Product

**"A financial analyst in your pocket."** The user adds a Google Pay transaction-statement PDF.
Miravelt reads every transaction, names the merchants, categorises the spending, finds recurring
payments and unusual spend, and explains it. There is no bank connection and no card access: the
statement is the only input.

A statement becomes a **period** (for example "Jan – Jun 2026"). The app is organised around
periods and **signals** rather than files: the home screen answers, in order, *what came in and
out*, *what should I know*, and *where did it go*.

## 3. Users

| User | Needs |
|---|---|
| **End user** (primary) - an individual in India paying mainly by UPI | Understand six months of spending in a minute, without sharing bank credentials |
| **Operator / admin** (secondary) | Manage users and roles, watch processing jobs and statements, publish app releases, run maintenance pipelines |

## 4. Principles (product-level)

1. **Grounded, never invented.** Every number maps to a backend-computed field. Explanations may
   only use retrieved data; with nothing retrieved, the system says so instead of generating
   (`/v1/explain` refuses to call the LLM without context).
2. **Honest uncertainty.** "Uncategorized" is a valid answer. A best guess is labelled as one.
3. **Private by default.** The statement is the only data source. The original PDF is kept only
   if the user allows it, and never shared.
4. **Degrade, don't break.** The LLM and vector search are enhancements. Statements still process,
   and analytics and computed signals still appear, when they are unavailable.

## 5. Scope and requirements

Status: **Shipped** = built and verified on a device against the local stack. **Partial** = built
with a known limitation. **Open** = not built.

### 5.1 Account and access (mobile)

| Requirement | Status |
|---|---|
| Register with email and password (8–128 characters); sign in; sign out | Shipped |
| Session persists across launches; access token (15 min) refreshes automatically from a rotating refresh token (30 days); a reused or expired refresh token forces sign-in | Shipped |
| A signed-in user never sees the login form on launch (splash while the session is checked) | Shipped |
| Edit display name | Shipped |
| Delete account and all data from the app | **Open** - the button signs out and tells the user to contact support |

### 5.2 Statement ingestion

| Requirement | Status |
|---|---|
| Pick a PDF with the system file picker; upload with progress | Shipped |
| Validate early and reject non–Google Pay files with a fix-it screen (how to export the right file) | Shipped |
| Password-protected PDFs: prompt for the password and retry; the password is never stored | Shipped |
| Files up to 10 MB; 10 uploads per minute per user | Shipped |
| Processing runs in the background with a stage-by-stage progress screen; the user can leave and come back | Shipped |
| Optional notification when analysis finishes (Profile toggle) | Shipped |
| "Keep original PDFs" toggle: off means the backend stores only the extracted transactions | Shipped |
| Reconciliation: computed sent/received totals are checked against the statement's own printed totals and shown | Shipped |
| A job interrupted by a server restart ends as "failed - please upload again", never spins forever | Shipped |
| Share a PDF from Google Pay straight into Miravelt | **Open** - the rejected-file screen describes it, but no share target is registered |

### 5.3 Understanding a period

| Requirement | Status |
|---|---|
| **Overview**: net flow, sent vs received, reconciliation, top signals, "Where it went" spending breakdown (Income excluded) | Shipped |
| **Period switcher**: switch periods, see in-progress ones, add a statement | Shipped |
| **Category drill-down**: category total, monthly bars, merchants in the category | Shipped |
| **Signals**: headline plus ranked insights typed WATCH / GOOD / CONTEXT, filterable | Shipped |
| Signals come from the LLM when available, otherwise from deterministic insights computed from the analytics | Shipped |
| **Recurring**: detected recurring payments with a regularity strip | Partial - detection needs 3+ payments within the statement; accuracy is limited by merchant naming |
| **Spending patterns**: calendar month-over-month, 30-day category patterns, top merchants | Partial - calendar-based, so it is empty for statements that don't cover recent months |
| Optional notification for WATCH-level signals in a new statement ("Unusual spend" toggle) | Shipped |

### 5.4 Transactions and corrections

| Requirement | Status |
|---|---|
| **Activity**: all transactions grouped by day with day totals; search by merchant; filter by direction, category and amount | Shipped |
| **Transaction sheet**: details, UPI reference, paying bank account, and "Why this category" worded from how the category was decided (known merchant / best guess / not matched / incoming) | Shipped |
| Correct a category; the correction applies to every transaction from that merchant and feeds the retraining queue | Shipped |
| Grounded natural-language explanation per transaction via `/v1/explain` | **Open** - the endpoint exists; the app does not call it yet |
| Export a period's transactions as CSV through the share sheet | Shipped |

### 5.5 Settings and support

| Requirement | Status |
|---|---|
| Theme: Light / Dark / Auto | **Partial** - the setting is stored, but screens use fixed surfaces, so it has almost no visible effect (see `DESIGN_SYSTEM.md` §9) |
| Privacy Policy and Terms of Service in-app | Shipped |
| In-app update prompt when a newer release is published (Android APK download) | Shipped |
| Developer settings (hidden; tap the version 5 times): choose the backend (deployed / emulator localhost / custom URL), test the connection, see build info; switching signs out first | Shipped |

### 5.6 Admin dashboard

| Requirement | Status |
|---|---|
| Admin sign-in (admin role required); credentials stay server-side | Shipped |
| Overview metrics; users (activate/deactivate, change role, delete); jobs; statements; releases | Shipped |
| Publish an Android release (APK) for the in-app updater | Shipped |
| Run maintenance pipelines (behaviour profiling, embeddings sync, memory decay, clustering, graph) | Shipped (API; admin key required) |

## 6. Key flows

1. **First run:** install → register → onboarding ("Add your first statement") → file picker →
   upload → Analysing (live stages) → Overview for the new period.
2. **Returning user:** launch → splash → Overview for the latest completed period.
3. **Investigate:** Overview → a signal or category → drill-down or transaction sheet → correct
   a category if wrong.
4. **Rejected file:** upload → "This PDF isn't a Google Pay statement" → instructions → choose a
   different file.

## 7. Non-functional requirements

| Area | Requirement | Measured (local stack, Pixel 7, release build) |
|---|---|---|
| Launch | Cold start to first frame < 1 s | 390–700 ms |
| Sign-in | Backend time for login + profile + periods < 1 s | ~0.8 s (0.35 + 0.21 + 0.25) |
| Upload | Accepted (202) in seconds; the server stays responsive during processing | Parsing now runs off the event loop; on the constrained local Docker VM, acceptance was 30–40 s before this fix |
| Processing | A six-month statement fully processed in about a minute | ~70 s locally, dominated by LLM insights on CPU |
| Availability | MongoDB is the only hard dependency; Milvus and Ollama outages degrade features, never fail the app | Verified |
| Security | Every route requires the app API key; user routes also require a JWT; operator routes require a separate admin key; switching backends never sends the session to the new host | Verified |
| Privacy | No bank or card access; PDF storage optional; PDFs auto-deleted after 90 days (`PDF_RETENTION_DAYS`) | Configured |
| Accessibility | 4.5:1 text contrast, 44px tap targets, colour never the only signal | Per `DESIGN_SYSTEM.md` §8 |

## 8. Success metrics (proposed - not yet instrumented)

- **Activation:** % of new accounts that complete a first statement upload within 24 hours.
- **Time to insight:** median seconds from upload tap to Overview.
- **Categorisation quality:** % of spend categorised (not Uncategorized), and the correction rate
  per 100 transactions.
- **Return use:** % of users who add a second period.

There is no product analytics in the app today, so these need instrumentation first.

## 9. Out of scope

Bank account or card linking; statements other than Google Pay; budgets and goals; iOS release
(the Flutter code builds, but has only been exercised on Android); multi-currency; shared or family
accounts; desktop drag-and-drop upload; donut or pie charts (a deliberate design decision).

## 10. Open issues and risks before launch

1. **No production deployment.** The release default backend URL has no live host yet.
2. **Release readiness:** an upload keystore exists and is configured locally, but no Play Console
   listing or production API key issuance process exists yet.
3. **Account deletion** is not self-serve (§5.1), which store policies may require.
4. **LLM sizing:** the insight LLM (`llama3`) needs more memory than the current local setup;
   deterministic insights cover the gap, but LLM-written signals need a properly sized host.
5. **Categorisation coverage:** payments to individuals (a large share of UPI spend) stay
   Uncategorized by design; user corrections are the path to better coverage.
6. **Processing is in-process** (FastAPI background tasks, one worker). A restart loses in-flight
   jobs (they are failed cleanly), and horizontal scaling needs a task queue first.
7. **Theme setting** does nothing visible until the design adds a dark reading surface.
