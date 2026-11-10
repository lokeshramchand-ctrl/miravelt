# DPDP Readiness for Indian App Teams: Full Startup Report
**Date:** 2026-11-10 · **Basis:** app-idea-hunter funnel, founder-skills (15 skills), startup plugin (design, competitors, positioning, pitch) · **Status of Miravelt:** shelved, no money invested

**Labels:** [Data] sourced · [Estimate] calculated from stated assumptions · [Assumption] untested · [Opinion] my judgment · [Verify] conflicting sources; check the gazetted text.

## 0. How to read this

- **Not legal advice.** The Rules summaries below come from law-firm and vendor commentary. I did not read the gazetted text. Anything marked [Verify] must be checked by an Indian privacy lawyer before it goes into a product.
- **Research limits.** I could not use Reddit directly, Google Trends, Similarweb, Meta Ads Library or Play Store review mining. Per the idea-hunter rules, the Reddit PMF gate is **unrun**, so no part of this idea has formally passed the demand gate.
- **Interviews are not done** (startup plugin Phase 3.7). They are experiment #1.
- Financials are **Stage A, assumption-based**.
- **Honest headline:** this is the best-supported idea I found, but it scores about **5.5/10** and faces a **crowded vendor market**. No version of it is 10/10 before customer evidence.

## 1. The idea in one paragraph

**DPDP-in-code for small app teams.** Indian app and SaaS teams of 1–20 people must meet the Digital Personal Data Protection Act by 13 May 2027. Existing tools are paperwork-first (templates, dashboards, consultancy) or enterprise-priced. This product is **developer-first**: a free open-source scanner reads your app's code and dependencies and produces a data inventory, a draft notice and a gap list. Paid add-ons supply consent SDKs (React Native, Flutter, web), consent receipts, a deletion-request workflow, a breach register and an evidence export for audits.

## 2. Pre-Flight Check

- ⚠️ **Dominant and crowded solutions exist.** India-specific vendors found: NitiBharat (from ₹1,499, free tier), DPDPA Shield (from ₹2 lakh), truConsent (₹8 lakh/yr), ConsentOS (from ₹2,999, BFSI-focused), Digital Anumati (custom pricing), plus Consent.in, Leegality, Digio, miniOrange, Rainmaker and others [Data: [NitiBharat](https://www.capterra.com/p/10049551/NitiBharat-DPDP-Compliance-Platform/), [DPDPA Shield](https://www.capterra.in/software/1238842/DPDPA-Shield), [truConsent](https://www.getapp.com/all-software/a/truconsent/), [Digital Anumati](https://toolradar.com/tools/digital-anumati/pricing)]. Global tools (Usercentrics, OneTrust, Termly, Cookiebot) sell too.
- ⚠️ **Flutter consent packages already exist** (shield_consent, consentera_consent on [pub.dev](https://pub.dev/packages/consentera_consent)). I found no React Native-specific DPDP SDK, but my search was shallow [Data, thin].
- ⚠️ **Deadline risk.** An industry body asked for a 24-month implementation period [Data: [Storyboard18](https://www.storyboard18.com/amp/how-it-works/iamai-urges-meity-for-24-month-implementation-period-of-dpdpa-rules-58597.htm)]. I did not confirm whether any extension was granted. The Rules were notified with phased dates.
- ⚠️ **Legal liability.** A tool that implies "you're compliant" can mislead buyers.
- ✅ **No legal ban on the activity itself.** Consent Manager is a separate registered role, and this product does not become one.

→ Context, not a verdict.

## 3. Intake summary

- **Founder:** a technical solo founder in India [Assumption], no money invested, comfortable with React Native, Python and web.
- **Constraints:** no capital, no legal staff, self-hosting capability (homelab).
- **Dogfood advantage:** Miravelt holds users' financial PDFs and needs consent, deletion and breach handling too. The founder is customer #1.
- **Budget:** a 14-day solo MVP [Assumption].

## 4. Regulation: what the product must address
All [Verify]. Sources are law-firm commentary. The product should show a "last reviewed" date and a lawyer sign-off.

| Obligation | What sources say | Product feature |
|---|---|---|
| **Notice** | Clear, itemised notice before or at consent; offer English or a chosen Eighth Schedule language (sources split on whether all 22 are required) [[K&S Partners](https://ksandk.com/md/data-protection-and-data-privacy/notice-obligations-under-dpdp-act-2023-clarity-access/)] | Notice generator, language selector |
| **Consent** | Free, specific, informed, affirmative; withdrawal as easy as giving it [[Mondaq](https://www.mondaq.com/india/data-protection/1721984/digital-personal-data-protection-act-2025)] | Consent SDK, withdrawal flow, consent receipts |
| **Security safeguards (Rule 6)** | Encryption, access control, logs; logs retained for one year [[Mondaq](https://www.mondaq.com/india/data-protection/1706890/a-closer-look-at-the-dpdp-rules-2025), [dpdpa.com](https://dpdpa.com/dpdparules/rule6.html)] | Checklist, log-retention guidance |
| **Breach notification (Rule 7)** | Inform the Board and affected people; detailed report within 72 hours | Breach register, timer, templates |
| **Erasure** | Delete when purpose is served or consent is withdrawn; processors must follow | Deletion-request workflow |
| **Children** | Verifiable parental consent; no tracking or targeted ads to children; exemptions exist [Verify numbering] [[Tsaaro](https://tsaaro.com/blogs/safeguarding-minors-online-understanding-parental-consent-obligations-and-behavioural-monitoring-restrictions-under-the-dpdpa-and-dpdp-rules)] | Age gate guidance, flagged as high-risk |
| **Processor contracts** | Fiduciaries must include security provisions in processor contracts | DPA template (lawyer-reviewed) |
| **Penalties (maximum, not fixed)** | Up to ₹250 cr for security failures; up to ₹200 cr for breach-notification failures and children's-data obligations; up to ₹50 cr residual [[KSK](https://ksandk.com/data-protection-and-data-privacy/penalties-adjudication-under-indias-dpdp-act-2023/)]. Imposed by the Board after an inquiry. | Used as framing only, never as a scare tactic |

**Dates [Verify]:** 13 Nov 2026 opens Consent Manager registration. **13 May 2027** is when the wider obligations apply. Sources agree on May 2027, and the date is about 184 days from today. Most small businesses have no new duty on 13 Nov 2026 ([Mondaq](https://www.mondaq.com/dpdp-act-and-rules-2025-the-2026-compliance-milestones-businesses-cant-afford-to-miss/1830402)).

**Startup exemptions:** I found no confirmed general startup exemption, and one guide says small businesses are not automatically exempt [Data, thin].

**Play Store link.** Google Play already requires apps with account creation to offer in-app and web deletion, and to delete associated data, not just deactivate ([Google](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-GB)). This is a second, existing forcing function for the deletion feature.

## 5. Market evidence

| Signal | Data | Confidence |
|---|---|---|
| Enterprises find the Act hard to interpret | About 71% of surveyed enterprises, EY India survey of about 150 professionals ([Medianews4u](https://www.medianews4u.com/nearly-71-of-indian-enterprises-struggle-to-interpret-dpdp-act-as-india-moves-into-execution-ey-india/)) | Medium (small sample) |
| Websites lack consent notices | 96% of 6,000+ sites, from a compliance vendor's press release ([Tribune](https://www.tribuneindia.com/news/business/96-of-indian-websites-collect-user-data-without-consent-reveals-largest-dpdp-compliance-study/)) | Low (vendor-run) |
| Budget anchors | CMP ₹0–15 lakh/yr; audits ₹1–10 lakh; fractional DPO ₹2–8 lakh/yr ([DEV](https://dev.to/mr_manushukla/dpdp-compliance-costs-for-indian-startups-what-to-budget-before-13-may-2027-fi8)) | Low (consultant-sourced) |
| "Under ₹50,000 a year" for startups under 10,000 users | A vendor claim, unverified ([ecorpit](https://ecorpit.com/dpdp-compliance-cost-indian-startups-2027-deadline/)) | Low |
| Global small-business price anchor | Cookie tools about $4–15/mo ([comparison](https://www.enzuzo.com/blog/cookiebot-vs-iubenda)) | Medium |
| Startup readiness | Early stage, moving at different speeds ([Inc42](https://inc42.com/features/dpdp-act-compliance-indian-startups-moving-at-different-speeds/)) | Medium |
| Number of Indian app teams, and who has budget | **Not found** | None |

**TAM/SAM/SOM [Estimate]:** I will not invent a market size. I found no sourced count of Indian app teams or of how many will buy.

**Flags.** 🔴 Crowded, with many vendors. 🔴 Demand figures are vendor-sourced. 🟡 The Capterra listing I saw had zero reviews, which suggests unproven demand rather than a hot market. 🟡 The deadline may slip.

## 6. Research Gate: YELLOW

- **Green:** firm statutory deadline with very large maximum penalties; visible willingness to pay at several price levels; founder-problem fit; a developer-first wedge that I did not find served.
- **Red:** crowded vendor field, vendor-sourced demand data, trust and legal-credibility hurdles, and a likely one-and-done usage pattern after setup.
- **Recommendation:** proceed only as a two-week validation. Do not build the full product first.

## 7. Customer Discovery: DEFERRED, experiment #1

Interview 10 people: 5 founders or CTOs of 1–20 person Indian app teams, 3 freelance or agency app developers, and 2 compliance or legal advisors.

**Proceed if:** at least 6 of 10 are not ready, at least 3 have looked at a tool, tried a lawyer or built a workaround, and at least 3 name a price. **Reassess if** most say "we'll deal with it later" or "the free tools are fine".

## 8. Positioning (April Dunford)

1. **Alternatives (what teams do now):** do nothing; hire a lawyer or fractional DPO (₹2–8 lakh/yr); enterprise CMPs (truConsent ₹8 lakh/yr); SME platforms (NitiBharat from ₹1,499); generic cookie banners (Termly, Cookiebot); DIY templates and open-source packages.
2. **Unique attributes [Assumption]:** reads your code and dependencies to build the inventory; works inside React Native, Flutter and web apps; consent receipts; developer pricing.
3. **Value:** go from "we haven't started" to a working consent, notice and deletion flow plus audit evidence, in a day rather than weeks.
4. **Best-fit customers:** small app and SaaS teams and the agencies that build apps for clients.
5. **Category:** "DPDP developer toolkit". Not "compliance platform", where you meet NitiBharat and truConsent head on.

**Moore statement:** For small Indian app teams who must meet DPDP by May 2027 without a legal department, [Product] is a developer toolkit that scans your app, drafts your data inventory and notice, and ships consent and deletion flows, unlike paperwork-first platforms, it works in your code.

**Onliness test: provisional.** "The only toolkit that scans your app's code to build your DPDP inventory" is plausible, but **I haven't verified that no competitor does this**. Check before using that claim.

## 9. Competitors

### 9.1 Matrix

| | NitiBharat | DPDPA Shield | truConsent | Digital Anumati | ConsentOS | Flutter packages | Global CMPs | **This idea** |
|---|---|---|---|---|---|---|---|---|
| Target | 51–500 staff firms | SMEs and BFSI | Enterprise | Enterprise-leaning | BFSI | Developers | Web and apps (GDPR-first) | 1–20 person app teams, agencies |
| Price | From ₹1,499, free tier | From ₹2 lakh | ₹8 lakh/yr | Custom | From ₹2,999 | Free | $4–39/mo (cookies) | ₹999–₹2,999/mo [Assumption] |
| Mobile SDK | Not publicly available | A Flutter plugin exists | Not publicly available | Not publicly available | Not publicly available | Flutter | Native SDKs (Usercentrics) | RN, Flutter, web |
| Code-aware scan | Not publicly available | Not publicly available | Not publicly available | Not publicly available | Not publicly available | No | No | **Yes (to build)** |

[Gap] Most vendors' feature sets are known only through directory listings. Verify with demos or trial accounts.

### 9.2 Battle cards (condensed)
- **NitiBharat.** *Strength:* cheapest India-specific tool, free tier, many templates. *Weakness:* paperwork-first; zero reviews on Capterra. *Beat it by:* working code and SDKs, not documents. *Don't fight on:* template count or price.
- **Enterprise CMPs (truConsent, DPDPA Shield).** *Strength:* credibility, features. *Weakness:* price and sales cycle. *Beat it by:* self-serve and developer-speed.
- **Flutter/open-source packages.** *Strength:* free. *Weakness:* not a compliance system. *Beat it by:* an end-to-end flow around the SDK (notice, receipts, deletion, evidence).
- **Fractional DPO and lawyers.** *Strength:* legal assurance. *Weakness:* cost and speed. *Partner with them* rather than compete (see GTM).

**Predicted moves:** vendors add mobile SDKs and cheap tiers as May 2027 nears (likely, medium confidence); global CMPs add DPDP templates; a free government or industry template may emerge (unknown).

## 10. Strategy

### 10.1 Lean Canvas [Assumptions]
- **Problem:** (1) Small teams don't know what DPDP requires of an app. (2) Compliance tools are paperwork or enterprise priced. (3) Hard to prove consent, deletion and breach readiness later.
- **Segments:** 1–20 person app and SaaS teams; agencies that build apps for clients.
- **UVP:** "DPDP-ready in a day, from your code."
- **Solution:** OSS scanner, consent SDKs, notice generator, deletion workflow, breach register, evidence export.
- **Channels:** GitHub, developer communities, SEO for "DPDP + React Native/Flutter", agency partnerships, lawyer referrals.
- **Revenue:** free scanner; paid subscription for hosted consent logs and evidence; one-off template packs; agency plans.
- **Costs:** lawyer review (largest), hosting (small), support.
- **Metrics:** scans run, apps with SDK installed, paid teams, retention after month 3.
- **Unfair advantage:** none yet. Candidates: the scanner's quality and a library of known SDK data flows.

### 10.2 Business model and unit economics [Stage A]
**[Assumption — unvalidated].** 300 paying teams at an average ₹1,800/month gives about ₹5.4 lakh MRR. Costs: lawyer retainer plus hosting plus support time. The hard question is churn: once a team is set up, it may cancel. **Retention must come from ongoing obligations:** consent logs, deletion requests, breach readiness, audit evidence exports, law updates and new-SDK re-scans.

### 10.3 Go-to-market, first 100 users
1. **OSS scanner** on GitHub with a clear "readiness report" output.
2. **SEO and tutorials:** "DPDP consent in React Native", "DPDP deletion endpoint for Play Store".
3. **Agencies and freelancers** who ship apps for clients (a multiplier: one agency means many apps).
4. **Lawyer and consultant referrals:** a "technical implementation partner" for privacy lawyers.
5. **Communities:** r/developersIndia, Indian startup communities, LinkedIn and X, pitched as help, not ads.

## 11. Pricing hypotheses (untested)

| Tier | Hypothesis | Basis |
|---|---|---|
| Free | OSS scanner, checklist, notice draft | Distribution; matches free competitors |
| Starter | ₹999/mo: 1 app, consent receipts, hosted notice (2 languages), deletion workflow | Sits near global small-business tools and NitiBharat's entry price |
| Team | ₹2,999/mo: 3 apps, breach register, evidence export, language packs | Mid-point between SME tools and ₹2 lakh tools |
| Agency | ₹9,999/mo: client workspaces | Multiplier channel |
| Add-on | ₹4,999 lawyer-reviewed template pack (one-off) | NitiBharat sells templates at ₹1,499 each |

**Biggest pricing risk:** free tools and a cheap incumbent anchor the price low, and a one-and-done pattern kills subscriptions. Test one-off versus subscription directly.

## 12. Product

### 12.1 MVP hypothesis
"Small app teams will run a free scan, and a meaningful share will pay for working consent and deletion flows plus evidence before May 2027."

### 12.2 PRD (condensed)
- **FR-001 Scanner CLI.** Reads `package.json`, `pubspec.yaml`, Android manifests and known SDK signatures (analytics, crash reporting, ads, auth). Outputs a data inventory (what, why, which vendor) and a gap list.
- **FR-002 Notice generator.** Drafts an itemised notice from the inventory; language selector; marks every placeholder that needs legal review.
- **FR-003 Consent SDK.** React Native and web first, Flutter later. Stores consent receipts (pseudonymous ID, purpose, version, timestamp). One-tap withdrawal.
- **FR-004 Deletion workflow.** Request form, a Play-Store-compatible deletion URL, status tracking, processor-deletion checklist.
- **FR-005 Breach register.** Incident log with a 72-hour timer and report templates.
- **FR-006 Evidence export.** A dated PDF or bundle of notices, consent logs, deletion actions and scan history.
- **Out of scope:** acting as a Consent Manager, giving legal advice, DPO services, enterprise multi-entity management.
- **Build order:** scanner, then notice, then deletion workflow, then consent SDK, then evidence export, then breach register.
- **Language rule:** say "readiness" and "draft", never "compliant" or "certified".

### 12.3 Technical notes
Data minimization by design: store only pseudonymous consent receipts. Hosting India-side. Security basics (encryption, access control, logs) are themselves Rule 6 requirements, so dogfood them. The product is a processor for its customers, so it needs its own DPA and a published grievance contact [Verify].

### 12.4 User journey
Find the OSS scanner, run it, see a readiness report (the "aha"), fix a few gaps by hand, hit a gap the free tool can't fix (consent receipts, deletion tracking, evidence), upgrade, receive monthly law and SDK-change alerts.

## 13. Brand and copy

**Brand:** calm, precise, honest. Voice: "We tell you what we don't know." Avoid fear marketing about ₹250 crore, and avoid "100% compliant".

**Landing page (hero):** *Your app has to be DPDP-ready by 13 May 2027. Scan your code in 5 minutes.* [Run the free scanner]
Subhead: *We find what personal data your app handles, draft your notice, and give you consent and deletion flows. Built for small teams. Not legal advice.*
**Proof strip (once true):** scans run, teams using it, lawyer-reviewed date.
**FAQ:** Is this legal advice? (No.) Do I need a Consent Manager? (Optional, not provided.) Where is data stored? (State it.)

**Hooks:** "Your analytics SDK is a DPDP problem. Here's how to check in 5 minutes." / "13 May 2027: what a 3-person app team has to ship." / "DPDP isn't a document. It's a deletion endpoint."

**X posts:**
1. DPDP isn't a PDF. For your app it's: a notice, consent you can prove, a way to delete, and a breach plan.
2. Quick check: does your app ship Firebase, a crash reporter and an ad SDK? You already have a data inventory problem.
3. Built a free scanner that reads your app and lists the personal data it touches. Not legal advice.

**LinkedIn:** *Lessons learned:* "I almost shipped an app holding users' financial PDFs with no deletion flow. Here's the checklist I wish I had." *Hot take:* "Most Indian startups don't have a compliance problem. They have a code-level data inventory problem."

**Lead magnet:** "DPDP Readiness Checklist for App Teams (React Native, Flutter, Android)". Post: "Comment CHECKLIST and I'll send it."

## 14. Outreach drafts (you send them, I don't)

**To agencies and freelancers:**
1. "Hi [name], your clients' apps will need DPDP flows (consent, deletion, notice) by May 2027. I built a free scanner that lists the personal data an app handles. Would you try it on one client app and tell me what's missing?"
2. After 3 days: "Happy to share a sample report first. No signup."
3. After 7 days: "I'll leave the repo link here in case it's useful later."

**To privacy lawyers:** "I'm building a developer toolkit for small app teams. I'd like a lawyer to review the templates and be listed as the reviewing partner. Could we do a 20-minute call?"

## 15. Marketing ideas, top 5
1. Open-source scanner as the free entry point.
2. Framework tutorials with exact code and SEO targets.
3. A public "DPDP changelog" for developers (new rules, FAQs, dates), which is also the retention hook.
4. Agency white-label pack.
5. A "DPDP readiness badge" teams can show once they pass the scan (careful wording).

## 16. Product Hunt
A reasonable fit for the OSS scanner, since PH audiences like developer tools, but India-specific compliance is niche there. Use it only as a credibility and backlink play, after you have real users and reviews, and time it a few weeks before the deadline.

## 17. SOP: onboarding a pilot team
1. Get written consent to scan their repo or a config export.
2. Run the scanner and review the output together.
3. List every personal-data purpose and the vendor behind it.
4. Draft the notice and mark all items for legal review.
5. Implement the consent and deletion flows in one sprint.
6. Export the evidence bundle and date-stamp it.
7. Log feedback, time spent and willingness to pay.
**Handling a deletion request:** verify identity, delete or anonymize across systems, instruct processors, record completion, reply to the user.

## 18. Validation

### 18.1 Experiment playbook (cheapest first)
1. **Interviews (deferred Phase 3.7):** 10 as above.
2. **Competitor reality check:** trial NitiBharat and one cheaper vendor, then check whether any scans code or ships a React Native SDK.
3. **Dogfood:** run the scanner on Miravelt and note what it gets wrong.
4. **Fake door:** a landing page with "Start free scan" and "Get consent and deletion flows ₹999/mo" (no payment). Count clicks from qualified traffic.
5. **Three pilot teams:** one sprint each. Measure time saved and whether they'd pay.
6. **Lawyer call:** confirm template costs and the "readiness" wording.

### 18.2 Risks

| Risk | Likelihood | Impact | Mitigation / warning signal |
|---|---|---|---|
| Crowded market, price pressure | High | High | Niche to developers; check vendors' mobile coverage |
| Deadline slips or is softened | Medium | High | Don't depend on it; build the ongoing-obligation features |
| One-and-done churn | High | High | Retention features; track month-3 retention |
| Legal liability from templates | Medium | High | Lawyer review, "readiness" language, ToS, insurance quote |
| Buyers don't trust a solo developer | High | Medium | Lawyer partner, open source, transparency |
| Vendor-sourced demand is overstated | Medium | High | Interviews and fake door |
| Consent logs create a new data-protection duty | Medium | Medium | Pseudonymous receipts, minimal storage |

### 18.3 Key assumptions

| Assumption | Confidence | Test | Status |
|---|---|---|---|
| Small app teams are unprepared | Medium-Low | Interviews | Untested |
| They will pay ₹999–2,999/mo | Low | Fake door, pilots | Untested |
| A code-aware scanner is a real wedge | Low | Competitor check, pilots | Untested |
| Demand lasts after May 2027 | Low | Retention data | Untested |
| React Native SDK gap exists | Low-Medium | Competitor check | Untested |

### 18.4 Kill criteria
1. Fewer than 6 of 10 interviewees say they are not ready.
2. Fewer than 3 of 10 name a price.
3. A competitor already ships a code scanner or React Native SDK at or below your price.
4. Fewer than 3 of 5 pilot teams say the output saved real time.
5. The deadline is formally extended and interviewees say they'll wait.
6. No paying team within 60 days of the paid beta.

### 18.5 Scorecard

| Dimension | Score /10 | Basis |
|---|---|---|
| Problem severity | 6 | Firm deadline and penalties, but vendor-sourced readiness data |
| Market size / monetizable | 5 | Real spending, unknown number of buyers |
| Defensibility | 3 | No moat; OSS and competitors can copy |
| Differentiation | 4 | Code-aware wedge is plausible but unverified |
| Distribution | 5 | Developer content and agencies, not yet proven |
| Monetization | 5 | Price anchors exist; churn is a risk |
| Execution / founder fit | 7 | Developer, dogfood customer, zero sunk cost |
| Timing | 7 | About 184 days to enforcement |
| **Overall** | **5.5 / 10** | |

**Verdict:** the best option I found, but conditional. Spend two weeks on validation, not on building. A realistic path to 8+ needs ten interviews, three paying pilots and a clear gap versus NitiBharat.

## 19. Pitch (only after validation)
Do not pitch investors now. Seed funding for consumer fintech is thin, and this idea has no traction. The draft below has placeholders.

**One-minute pitch:** "By 13 May 2027, every Indian app that handles personal data must give notice, collect provable consent, delete on request and report breaches. Small teams can't afford ₹2–8 lakh consultants, and the cheap tools are paperwork. We give developers a free scanner that reads their app and a toolkit that ships the flows in a day. **[Traction: none yet. Insert scans run, pilots, paying teams.]**"
**Q&A prep:** "Why not NitiBharat?" Different layer (code versus paperwork), unproven. "What if the deadline moves?" Ongoing obligations remain, unproven. "Liability?" Readiness not certification, lawyer reviewed.
**Pitch score:** about 3/10 today (story fair, evidence missing).

## 20. Strategic plan and 30-day action plan

**Strategic moves:** (1) validate demand and the wedge; (2) build the OSS scanner as the distribution asset; (3) secure a lawyer reviewer before charging.

**Week 1: Discovery.** Write the interview script and recruit 10 people. Trial two competitor tools. Run the scanner idea on Miravelt by hand to find what it should detect.
**Week 2: Build and test.** Ship a minimal scanner (package files plus manifest) and a notice draft. Launch the fake-door page and publish one tutorial. Run 3 pilots.
**Week 3: Decide scope.** Based on interviews and pilots, build only the paid feature people asked for (likely deletion or consent receipts).
**Week 4: Decision.** Apply the kill criteria. Continue to a paid beta, pivot the wedge (agency pack, or a Shopify and web focus), or stop.

## 21. Anti-patterns detected
- **Crowded market underestimated.** My first pass called the low end underserved. The research shows a dozen vendors.
- **Building before customer contact.** Avoid repeating the Miravelt pattern.
- **Vanity metrics risk.** Count paid pilots and month-3 retention, not scan downloads.
- **Fear-based demand.** Penalty headlines are maximums, imposed after inquiry. Don't build the business on scaring people.

## 22. Final honest summary
- **Why this over Miravelt:** a deadline, visible willingness to pay, founder-problem fit and a developer wedge, with no sunk cost.
- **Why it might still fail:** crowded vendors, vendor-sourced demand, a solo developer in a trust-driven market, legal liability, one-and-done churn and a deadline that could move.
- **What would change my mind:** interviews showing teams haven't started and will pay, plus a confirmed gap in code-aware, mobile-first tooling.
- **First step:** interview 10 people and trial two competitors, before writing a line of product code.
