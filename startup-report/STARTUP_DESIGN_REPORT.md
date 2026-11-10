# Miravelt: Startup Design Report (startup-skill plugin)
**Date:** 2026-11-10 · **Plugin:** startup@startup-skill (startup-design, startup-competitors, startup-positioning, startup-pitch) · **Companion to:** `FOUNDER_REPORT.md`

**Labels (per the plugin's honesty protocol):** [Data] sourced · [Estimate] calculated from stated assumptions · [Assumption] untested · [Opinion] my judgment.

## 0. How this was run, and what could not be done
- Installed with `claude plugin marketplace add` and `claude plugin install` (scope: user). The skills were not auto-loaded in this running session, so I read the plugin's `SKILL.md` files and followed their phases by hand.
- The plugin spawns many research subagents and writes a multi-folder project. I ran a **compressed** version: about 14 web searches across both reports, no subagent waves, and one consolidated document instead of about 30 files. This is closer to Fast Track than the full 4-wave process. Depth is lower than the plugin intends.
- **Customer Discovery (Phase 3.7) was NOT done.** It needs 5+ real interviews. It is **deferred and is experiment #1** below.
- All financials are **Stage A, assumption-based**. No interview or traction data exists.
- Unavailable to me: Sensor Tower, Similarweb, Google Trends, Meta Ads Library, Play Store reviews, direct Reddit access. The pitch contains **no traction numbers** because none exist.

## 1. Pre-Flight Check
- ⚠️ **Dominant solutions exist.** Google Pay now has an in-app Gemini assistant [Data: [Business Today](https://www.businesstoday.in/amp/technology/news/story/google-pay-introduces-ai-powered-ask-google-pay-track-spending-understand-sips-and-access-more-credit-546164-2026-07-30)]. Paytm has Spend Summary [Data: [Paytm](https://paytm.com/blog/payments/paytm-introduces-automatic-spend-categorization-and-monthly-spend-summary-for-smarter-expense-tracking)]. Fold and CRED Money use Account Aggregator data [Data: [Inc42](https://inc42.com/buzz/kunal-shah-led-cred-unveils-new-offering-to-help-customers-manage-bank-accounts-track-expenses)].
- ⚠️ **Precedent.** Walnut was acquired by Paytm (2021) and reportedly shut down. Fi wound down in-app banking in March 2026, though it was a neobank rather than a tracker [Data: [TechCrunch](https://techcrunch.com/2026/03/11/india-neobank-fi-winds-down-banking-services-on-its-platform)]. Niro shut down citing regulatory and funding problems [Data: [Entrackr](https://entrackr.com/news/lending-startup-niro-shuts-down-operations-10538020)]. I found no clean case of a standalone tracker dying in 2025-26, but the sources are weak.
- ⚠️ **Regulation.** India's DPDP Rules 2025 were notified in Nov 2025 and phase in over about 12-18 months, with penalties up to ₹250 crore [Data, sources differ on dates: [Mondaq](https://www.mondaq.com/india/data-protection/1721984/digital-personal-data-protection-act-2025), [YourStory](https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months)]. You hold users' financial documents, so this applies to you.

→ This is context, not a verdict.

## 2. Intake summary (reconstructed from PRD.md, not interviewed)
- **Idea:** Upload a Google Pay statement PDF and get categorized spend, recurring payments, unusual spend and explanations. There is no bank or SMS access.
- **Stage:** Built (Android app, backend, admin). Pre-production, zero users, zero revenue [Data: PRD].
- **Founder:** Technical, solo or tiny team [Assumption].
- **Constraints:** Self-hosted homelab; the LLM runs on a 4-core CPU box [Data: your deployment notes].

## 3. Brainstorm: six variations and my read

| # | Variation | Exciting | Risky |
|---|---|---|---|
| 1 | Current: B2C GPay PDF analyzer | Built, privacy angle | Platform threat, one-shot use |
| 2 | **Multi-app consolidator** (GPay + PhonePe + Paytm + bank PDFs) | Platforms can't do this; roughly doubles the base | Parsers per format; still PDF friction |
| 3 | **Freelancer and small-seller UPI income report** (tax-time, sold per report) | Clear job, deadline, willingness to pay [Assumption] | Narrower; accountants may already handle it |
| 4 | **B2B transaction-enrichment API** (the engine behind the README: noisy narration to merchant and category) | VCs prefer infra over consumer apps [Data: [Whalesbook](https://www.whalesbook.com/news/English/tech/India-Fintech-Funding-Shift-Fewer-Deals-Larger-Cheques-in-Q1-2026/69f0d0cf35c37de4af378cf7)]; works on Account Aggregator data too | **Unresearched here**: competitors (Perfios etc.), your accuracy vs. theirs, sales cycles |
| 5 | Household or couples shared view | Retention hook | Out of PRD scope; unproven demand |
| 6 | Bank-statement and AA ingestion for the same product | Escapes GPay dependence | Competes head-on with Fold and CRED |

[Opinion] Variations 2 and 3 are the cheapest to test. Variation 4 is the highest-ceiling but needs its own research, and the repo's `evaluation/` folder suggests you can benchmark categorization accuracy first.

## 4. Research synthesis

### 4.1 Market [Data unless noted]
- UPI onboarded users: **55.49 crore** as of June 2026, cumulative, not monthly active ([PIB via Superkalam](https://superkalam.com/current-affairs/21-07-2026/nearly-55-49-crore-users-onboarded-on-upi-as-in-june-2026-0e1277f0-b7e4-41e0-8a9b-5b55443bbe90)). NPCI doesn't publish monthly actives; secondary sites say 350-400M, **low confidence**.
- Volume: 2,366 crore transactions in July 2026, a record ([same source set](https://superkalam.com/current-affairs/21-07-2026/nearly-55-49-crore-users-onboarded-on-upi-as-in-june-2026-0e1277f0-b7e4-41e0-8a9b-5b55443bbe90)).
- Share by transactions, Sept 2026: PhonePe 45.6%, Google Pay 32.2%, Paytm 8.1% ([IMARC](https://www.imarcgroup.com/insight/top-fintech-companies-india); single-source decimals).
- **Account Aggregator (AA) is the structural threat.** The AA ecosystem reportedly has **5.96 crore PFM users**, growing 164% CAGR since FY23 ([NewKerala, June 2026](https://www.newkerala.com/news/a/indias-account-aggregator-ecosystem-facilitates-nearly-38-crore-263.htm); a news summary, underlying source unconfirmed). PhonePe runs an AA micro-app. AA gives consented, structured, bank-wide data with no PDF step.
- **TAM/SAM/SOM [Estimate]:** I will not produce a TAM figure. I found no sourced market size for UPI-statement analysis or consumer PFM revenue in India. A defensible serviceable pool is roughly "Android GPay users willing to export a PDF", and that fraction is unknown.

**Flags.** 🔴 AA makes PDF-based ingestion a stopgap if consent UX matures. 🟡 Monetizable market size is unproven. 🟡 Market-size data is thin and secondary.

### 4.2 Competitors, summary (full matrix in §8)
Platform assistants (Google, Paytm), lender-owned trackers (Money View, Axio), AA-based PFMs (Fold, CRED Money), PDF/SMS niche tools (Ruply), and free open source. Money View's revenue is overwhelmingly lending [Data: [Inc42](https://inc42.com/buzz/moneyviews-fy24-revenue-jumps-75-to-inr-1012-cr)], so pure tracking is a feature that others monetize through credit.

### 4.3 Customer voice [Data, thin]
- One April 2026 Reddit snapshot: users distrust apps that need OTP or bank sync and share data with lenders; suggestions included Fold, Cashew, FinArt, PennyWise ([mirror](https://reddit.sentinel-team.org/posts/1s8kxw0/snapshots/2026-04-03T16%3A02%3A41.839959Z)).
- SMS trackers break when banks change formats, and P2P transfers get miscounted [Data, low-authority: [Finny](https://getfinny.app/blog/sms-expense-tracking-app)].
- Complaint seen for Fold: users want to split one payment across categories [Data: [GrowthX](https://community.growthx.club/proof-of-work/fintech/fold-/fold-----acquisition-project|67e428fa376ac306b9c565da)].
- **No sourced evidence of anyone asking for a GPay PDF analyzer.** This is the biggest hole.

### 4.4 Distribution
- Google Pay offers a PDF/e-statement of its own transaction history ([Google help](https://support.google.com/pay/india/answer/7430307?hl=en-IN)). **The input exists officially.** It covers only GPay payments, not all UPI.
- Paytm offers Excel UPI statements [Data: [Outlook Money](https://www.outlookmoney.com/banking/paytm-launches-excel-upi-statements-simplifies-tax-filing-expense-monitoring)], so multi-app input is feasible.
- Google Play restricts SMS permission and requires a declaration for "SMS-based money management" ([Play policy](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en)). The policy table was hard to parse, so verify before relying on it. A no-SMS design avoids that review.

### 4.5 Confidence dashboard

| Claim | Basis | Confidence |
|---|---|---|
| Google Pay has an in-app AI spend assistant | Multiple news outlets | High |
| UPI scale (55.49 cr onboarded) | Government statement via news | High |
| Market-share decimals | One source | Medium |
| AA PFM user count | One news summary | Low-Medium |
| Willingness to pay | None | None |
| Demand for a GPay-PDF analyzer | None | None |

## 5. Research Gate: **YELLOW leaning RED**
- **Green signals:** the pain is plausible; the input format exists officially; a privacy niche exists; the product is built.
- **Red signals:** the platform shipped your core feature; AA is displacing manual ingestion; consumer-fintech seed money is thin ([Tracxn via The Week](https://www.theweek.in/wire-updates/business/2026/04/28/indian-fintech-funding-holds-steady-at-usd-513-mn-in-q1-2026-deal-volume-halves.html): seed fell, mostly late-stage money); zero demand evidence.
- **Recommendation:** continue only as a cheap validation exercise on Variations 2, 3 or 4. Do not fund more feature building.

## 6. Customer Discovery: **DEFERRED, experiment #1**
Run 5-10 interviews of Android UPI users (ideally mixed GPay/PhonePe, and some freelancers). **Proceed** only if 4 of 5 confirm the problem unprompted and at least 2 show behavior (paid, built a spreadsheet, tried an app). Otherwise reassess. A strategy built without this is a hypothesis.

## 7. Strategy

### 7.1 Lean Canvas [Assumptions throughout]
- **Problem:** (1) UPI history shows what happened, not what it means. (2) Trackers want SMS, OTP or bank access. (3) Payments to individuals are opaque.
- **Segment:** Privacy-wary Android UPI users; early adopter = people who already keep a spreadsheet or tried an app and quit [Assumption].
- **UVP:** "Understand your UPI spending from one PDF, with no bank login or SMS access."
- **Solution:** PDF import, reconciliation to the statement's printed totals, categories, recurring and unusual payments.
- **Channels:** Personal-finance communities, shareable year-end card, SEO on export how-tos.
- **Revenue:** Free first statement, then paid per report. Subscription only after repeat use is proven.
- **Costs:** LLM hosting, storage, support, compliance.
- **Key metrics:** statements uploaded, second-statement rate, categorization coverage, correction rate, paying %.
- **Unfair advantage:** none yet. [Opinion] The merchant-resolution engine and reconciliation could become one with measured accuracy.

### 7.2 Business model [Stage A]
Illustrative only. **[Assumption — unvalidated]** A one-off ₹149 report. If 10,000 free users convert at 3%, revenue is about ₹44,700. That is far below the cost of a self-hosted LLM box plus compliance. [Opinion] A consumer one-off model needs a much larger funnel, or a higher-value niche (Variation 3), or B2B (Variation 4). Do not show these numbers to investors as projections.

### 7.3 Go-to-market, first 100 users
1. Personally onboard 15 testers (concierge) from finance communities.
2. Ship a shareable "UPI Wrapped" card for Dec-Jan.
3. SEO guides: "how to export Google Pay/PhonePe/Paytm statement".
4. If freelancers pay, add a CA/accountant referral channel.

## 8. Competitors skill output

### 8.1 Feature and positioning matrix
| | Ask Google Pay | Paytm Spend Summary | Money View / Axio | Fold / CRED Money | Ruply | **Miravelt** |
|---|---|---|---|---|---|---|
| Input | In-app history | In-app history | SMS / bank | Account Aggregator | SMS + PDF | GPay PDF |
| Needs SMS/bank link | No | No | Yes | Yes (consent) | Optional | **No** |
| Cross-app view | No | No | Partly | Yes (banks) | Partly | **No (yet)** |
| Privacy claim | Opt-in Personalisation | Platform | Weak (SMS access) | Consent-based | On-device (claimed) | **Server-side; claim must be fixed** |
| Monetization | Platform ecosystem | Platform | Lending | Mixed | Not publicly available | **None** |

### 8.2 Pricing landscape
No sourced consumer-tracker price points were found, and most competitors monetize indirectly (lending, ecosystem). **[Gap]** Ruply's pricing is not publicly available in my results. [Opinion] This means a standalone price must be tested from scratch against free alternatives.

### 8.3 Battle cards (condensed)
- **Ask Google Pay.** *Strength:* zero friction, native data, 10 languages. *Weakness:* single-app only, opt-in, limited rollout, "informational" disclaimer. *Beat it by:* cross-app merge and reconciled totals. *Don't fight it on:* "chat with your spending".
- **Ruply.** *Strength:* PDF + SMS + Q&A, on-device claim. *Weakness:* unknown traction. *Beat it by:* verified on-device or auto-delete processing and statement-reconciliation proof, **or avoid head-on and go niche**.
- **Fold / CRED Money.** *Strength:* automatic AA data, no uploads. *Weakness:* consent friction and credit push [Data, low-authority]. *Beat it by:* serving people who refuse to link accounts.

**Flags.** 🔴 Ruply overlaps your core claim. 🟡 No competitor revenue is sourced beyond Money View.

## 9. Positioning skill output (April Dunford)

1. **Competitive alternatives (what users do if you don't exist):** scroll the GPay history; spreadsheet; SMS tracker; AA-based app; Ask Google Pay; do nothing.
2. **Unique attributes:** reads a document the user already has; reconciles to the statement's own totals; says "Uncategorized" rather than guessing; no SMS/bank permission.
3. **Value:** understanding spend without handing over access.
4. **Best-fit customers [Assumption]:** privacy-wary Android UPI users, freelancers who need a clean income/expense record.
5. **Market category (recommended):** *Private UPI statement analysis.* Do **not** use "personal finance manager", where you lose to Fold, CRED and Money View.

**Moore statement:** For privacy-conscious Indian UPI users who want to understand where their money goes, Miravelt is a statement analyzer that turns the PDF you already have into a reconciled spending picture, unlike SMS and bank-link trackers, it never asks for access to your accounts or messages.

**Neumeier Onliness Test: FAILS today.** "The only PDF-based tracker" is false because Ruply exists. It passes only if you can truthfully claim "the only one that reconciles to your statement totals and processes without keeping your file". Both claims are currently unproven (reconciliation exists in the app; the keep-nothing claim does not match server-side processing). Fix the product claim, then re-test.

## 10. Product

### MVP hypothesis
"People will upload a statement and come back for a second month (or pay for a report)."
- **Must-have:** PDF import, reconciliation, categories, correction loop, honest privacy wording, account deletion.
- **Add next:** PhonePe/Paytm importers; a repeat-use hook (monthly reminder or Wrapped card).
- **Out of scope:** budgets, goals, chat, new analytics, AA integration, until validation passes.
- **Success:** 5 of 15 testers return for month two, and 3 name a price.

[Opinion] The most valuable engineering task is **not** new features. It is making the privacy claim literally true (process and delete) and adding DPDP-ready consent and deletion flows.

## 11. Brand (compressed)
Personality: calm, precise, candid. Voice: "We say 'we don't know' when we don't." Avoid: "AI-powered", "financial advisor", real-time monitoring. Avoid the current landing page's implication of live tracking.

## 12. Validation

### 12.1 Experiment playbook (cheapest first)
1. **Customer interviews (deferred Phase 3.7).** 5-10 people; behavior signals required.
2. **Concierge MVP.** 15 statements hand-processed, with a deletion confirmation sent. Measure return and payment intent.
3. **Fake-door pricing.** A landing page with a "get my report, ₹149" button (no payment). A 5%+ click-through on qualified traffic is a signal [Assumption].
4. **Niche split test.** Offer the same service to freelancers (income/tax framing) and general users. Compare response.
5. **Accuracy benchmark (for Variation 4).** Measure categorization accuracy on a labeled sample and compare against a competitor's output.

### 12.2 Risks

| Risk | Likelihood | Impact | Mitigation / warning signal |
|---|---|---|---|
| Google Pay's assistant removes the need | High | High | Cross-app niche; watch rollout news |
| AA consent UX improves, PDF friction loses | Medium | High | Prepare AA/bank-data ingestion path |
| No repeat use | High | High | Retention hook; kill if <5/15 return |
| Privacy mismatch becomes a trust incident | Medium | High | Fix wording and processing now |
| DPDP non-compliance | Medium | Medium | Consent notice, deletion, breach plan |
| PDF format change breaks parser | Medium | Medium | Parser tests, format monitoring |
| No willingness to pay | High | High | Fake-door and concierge tests |

### 12.3 Key assumptions

| Assumption | Confidence | Test | Status |
|---|---|---|---|
| Users have this pain enough to upload a PDF | Low | Interviews | Untested |
| Users return monthly | Low | Concierge | Untested |
| Users pay ₹99-199 | Low | Fake door | Untested |
| Privacy is a purchase driver | Low-Medium | Interviews | Untested |
| Categorization is accurate enough | Unknown | Benchmark | Untested |

### 12.4 Kill criteria (stop or pivot if any hit)
1. Fewer than 5 of 15 testers upload a second statement.
2. Fewer than 3 of 15 name a price they would pay.
3. Fewer than 4 of 5 interviewees confirm the pain unprompted.
4. Categorization coverage stays below what testers accept (set the bar after the benchmark).
5. Ask Google Pay (or PhonePe) rolls out broadly and testers say it is "good enough".
6. After 60 days, still zero paid conversions.

### 12.5 Scorecard

| Dimension | Score /10 | Basis |
|---|---|---|
| Problem severity | 5 | Plausible, unproven |
| Market size / monetizable | 4 | Huge users, thin proven revenue |
| Competition / defensibility | 3 | Platform and AA threats |
| Differentiation | 4 | Privacy and reconciliation, partly unproven |
| Distribution | 4 | No proven channel; Wrapped idea |
| Monetization | 3 | No model, free alternatives |
| Execution / readiness | 6 | Working product, gaps in privacy and compliance |
| **Overall** | **4 / 10** | |

**Verdict (4-5 band: significant concerns):** Do not invest more build time. Run experiments 1-3 over 2-3 weeks. Pivot toward Variation 2, 3 or 4 unless the interviews surprise you. [Opinion] If forced to pick today, test **Variation 3 (freelancer UPI income/expense report)** first, because it has a deadline and a clear buyer; test **Variation 4 (B2B enrichment)** in parallel as a research task, since it reuses what you built and fits where investors are putting money.

## 13. Pitch skill output
**First, the honest answer: do not pitch investors yet.** Consumer-fintech seed is tight [Data: Tracxn via [The Week](https://www.theweek.in/wire-updates/business/2026/04/28/indian-fintech-funding-holds-steady-at-usd-513-mn-in-q1-2026-deal-volume-halves.html)], you have no traction, and the Account Aggregator and platform threats would be the first questions. The pitch below is a draft with placeholders. I did not invent traction.

### 13.1 One-minute pitch (draft)
"Every UPI user has a complete record of their spending, a PDF nobody can read. The apps that could explain it want your bank login or your SMS inbox. Miravelt reads the statement you already have, reconciles it to the printed totals, and shows where the money went, what repeats and what is unusual. We say 'unknown' rather than guess. **[Traction: none yet. Insert tester count, return rate and paying users once you have them.]** We're validating [the freelancer report / cross-app view] before raising."

### 13.2 Two-minute structure
Problem → why existing tools fail (access demands, platform silos) → insight (the statement is the underused asset) → product → **why now** (statements exist; privacy rules tightening; but be candid that Google and AA are moving too) → validation plan and the ask. **The ask is not money yet.** It is 10 testers or introductions.

### 13.3 Investor email
Skip until you have data. When ready, lead with the result (e.g. "[X] of [Y] testers returned for month two"), not the architecture.

### 13.4 Deck outline (10 slides)
1 Problem · 2 Insight · 3 Product demo · 4 Why now (and honest risks) · 5 Market (sourced) · 6 Competitors and positioning · 7 Traction (from validation) · 8 Business model · 9 Roadmap (validated step only) · 10 Ask.

### 13.5 Q&A you will get, and honest answers
- *"Why won't Google Pay's assistant kill you?"* Only partly. Cross-app and non-opt-in users are the claim; unproven.
- *"Why not Account Aggregator?"* A fair threat; mitigations are your multi-source ingestion and the enrichment engine.
- *"How do you make money?"* Not yet proven; here are the experiments.
- *"Privacy?"* Only answer this after fixing server-side retention and the claims.

### 13.6 Pitch score (rubric applied)
**Story clarity: 7. Evidence: 2. Market insight: 4. Defensibility: 3. Ask readiness: 2. Overall: 3-4/10.** Not fundable yet; raising later on Variation 3 or 4 with real numbers is a different conversation.

## 14. Anti-patterns detected
- **Building in stealth too long:** a full product and a 15-stage pipeline with zero customer contact.
- **Solution looking for a problem:** engineering sophistication leads the story; user pain is unsourced.
- **Premature scaling:** Celery, Milvus, clustering and graphs for a pre-user product.
- **Ignoring unit economics:** no pricing, and the Stage A numbers don't cover infra.
- **Vanity-metric risk:** no analytics exist, so "signups" would be easy to over-read; track returns and payments.

## 15. 30-day action plan
**Week 1: Discovery.** Write the interview script; recruit 10 people (finance subreddits, friends of friends, freelancers); run 5; record behavior signals. Fix the landing hero and add Google Pay/PDF/India wording.
**Week 2: Experiments.** Run the concierge (15 statements) with deletion confirmations. Launch the fake-door page. Run the accuracy benchmark.
**Week 3: Scope.** Decide the niche from data. If freelancers respond, build only the report export; if cross-app, add one importer; if neither, stop.
**Week 4: Decide.** Apply the kill criteria. Continue, pivot or stop. Only then plan DPDP-ready consent/deletion flows and any fundraising conversation.

## 16. Final honest summary
- **Strengths:** shipped product, sharp privacy pitch, reconciliation, an honest-uncertainty culture, a possibly valuable enrichment engine.
- **Fatal-risk candidates:** (1) the platform built your feature; (2) AA may make PDFs obsolete; (3) no demand or price evidence.
- **What would change my mind:** interviews showing paid workarounds, a 5/15 return rate, or three people naming a price.
- **Best next step:** stop coding, talk to 10 people, and test the freelancer report and the B2B enrichment angle.
