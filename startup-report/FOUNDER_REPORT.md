# Miravelt: Founder-Skills Startup Report
**Date:** 2026-11-10 · **Skill pack:** ognjengt/founder-skills (15 skills) · **Companion to:** the earlier app-idea-hunter evaluation

## 0. How this was run (read first)

- `npx skills add` failed: the installer needs Node ≥22.20 and this machine has Node 20.19. I cloned the repo instead and read each `SKILL.md` directly. Nothing was installed into your project or global skills.
- Skills that normally ask diagnostic questions (strategic-planning, go-to-market, pricing, outreach, product-hunt, prd) ran on **assumptions** from `PRD.md` and the earlier evaluation. Assumptions are labelled.
- Competitor research used web search only. Per the skill's rule, anything I could not source is marked "Not publicly available". **Not available to me:** Sensor Tower, Similarweb, Google Trends curves, Meta Ads Library, Play Store review mining, and direct Reddit thread access. Those gaps weaken every conclusion below, and I say where.
- Anything labelled **hypothesis** is untested. It is a thing to test, not a finding.

## 1. Verdict

| Question | Honest answer |
|---|---|
| Is the pain real? | Plausible, not proven. People do complain about SMS-permission and OTP-sync apps (one Reddit mirror thread, Apr 2026). I found no thread asking specifically for a Google Pay PDF analyzer. |
| Is the niche paid? | Yes, but by lenders. Money View's revenue is mostly lending, and the expense tracker was originally free. Pure expense-tracking has no proven revenue in my results. |
| Is it defensible? | Weak today. Google launched an AI spending assistant inside Google Pay in July 2026. Paytm already ships categorized Spend Summaries. |
| Is it a startup? | Not yet. It is a well-built product with no validated user, price or distribution channel. |

**The most important new fact:** "Ask Google Pay" (Gemini-powered, ten Indian languages, opt-in, limited rollout) answers "how much did I spend on food last month?" inside the app. That is close to your core promise, from the platform that produces your input file. See §2.

**Where Miravelt can still win (hypotheses, in order of strength):**
1. **Cross-app and cross-bank consolidation.** A single app's assistant only sees its own data. Nobody in my results consolidates GPay + PhonePe + bank PDFs privately.
2. **Privacy for people who won't opt in** to Google's Personalisation or grant SMS access.
3. **A job-based niche** (freelancer or tax-season reports) where "where did it go" is not the question.

## 2. Competitor Intel (competitor-intel skill)

**Sources searched:** 10 web queries, 2026-11-10. Direct Crunchbase, Similarweb, G2 and Meta Ads Library lookups were not possible.

### 2.1 Verified metrics

| Competitor | What was found | Source | Notes |
|---|---|---|---|
| **Google Pay "Ask Google Pay"** | Gemini assistant answering spend questions; 10 Indian languages; opt-in via Personalisation; limited rollout; launched about 30 Jul 2026 | [Business Today](https://www.businesstoday.in/amp/technology/news/story/google-pay-introduces-ai-powered-ask-google-pay-track-spending-understand-sips-and-access-more-credit-546164-2026-07-30), [Crowdfund Insider](https://www.crowdfundinsider.com/2026/08/294820-google-pay-introduces-gemini-enabled-ai-tool-for-users-in-india/) | Rollout scope and query limits: not publicly available |
| **Paytm Spend Summary** | Automatic categorization, monthly summary, custom tags; Excel UPI statement download | [Paytm blog](https://paytm.com/blog/payments/paytm-introduces-automatic-spend-categorization-and-monthly-spend-summary-for-smarter-expense-tracking), [Outlook Money](https://www.outlookmoney.com/banking/paytm-launches-excel-upi-statements-simplifies-tax-filing-expense-monitoring) | Company-authored, promotional |
| **Money View** | FY24 operating revenue ₹1,012 Cr (+75%); Series D $75M at $625M (Mar 2022); Series E $75M at $900M; DRHP filed Mar 2026 | [Inc42](https://inc42.com/buzz/moneyviews-fy24-revenue-jumps-75-to-inr-1012-cr), [Fintech Futures](https://www.fintechfutures.com/venture-capital-funding/money-view-secures-75m-series-e-funding-at-900m-valuation) | Started as a free expense tracker; revenue is now lending. User counts conflict across sources |
| **Axio (ex-Walnut)** | Brand of CapFloat, an RBI-registered NBFC; SMS-parsing tracker plus BNPL | [Analytics Vidhya](https://www.analyticsvidhya.com/blog/2024/11/ai-budgeting-tools/) | User count, revenue: not publicly available. Funding figures seen were low-quality and unverified |
| **Ruply** | "Expense tracker built for India"; accepts bank PDF statements, SMS parsing, Q&A; says data stays on device | [Product Hunt](https://www.producthunt.com/products/ruply), [App Store](https://apps.apple.com/in/app/id6759892536) | Pricing: not publicly available. **Closest direct competitor found** |
| **PhonePe** | No consumer spend-insights feature found; its 2026 launch (PulsePro) is enterprise-only | [Angel One](https://www.angelone.in/news/economy/phonepe-launches-pulsepro-to-help-businesses-track-consumer-spending-trends-using-upi-data) | Absence in search is not proof of absence in the app |
| **Open source** | UPI Expense Tracker on F-Droid (accessibility service plus SMS, offline) | [F-Droid](https://f-droid.org/en/packages/com.goushik.upiwallet/) | Free, so a price floor of zero exists |

### 2.2 Market context

- UPI share by transactions, Sept 2026: PhonePe 45.57%, Google Pay 32.23%, Paytm 8.1%, per [IMARC](https://www.imarcgroup.com/insight/top-fintech-companies-india) (single-source decimals; May 2026 figures from [Outlook Business](https://www.outlookbusiness.com/economy-and-policy/phonepe-google-pay-combined-upi-market-share-drops-below-80-for-first-time) agree within about 1 point).
- Google Pay-only therefore covers roughly a third of UPI transactions. This is the biggest structural limit in the current product.
- NPCI's 30% share-cap deadline was pushed to 31 Dec 2026 ([Angel One](https://www.angelone.in/news/market-updates/npci-extends-market-share-cap-on-upi-apps-by-another-two-years)). Share may keep shifting.

### 2.3 Leverage strategies

**Strategy 1: Be the neutral consolidator**
- *Weakness exploited:* Each platform's insight tool sees only its own transactions. Ask Google Pay and Paytm Spend Summary are single-app.
- *Evidence:* The sources above describe in-app features only.
- *Steps:* (1) Add PhonePe and Paytm statement parsers, since Paytm already offers Excel export. (2) Merge periods across apps into one deduplicated view. (3) Message it as "all your UPI apps, one picture".
- *Outcome (hypothesis):* A feature Google structurally won't build.

**Strategy 2: Own the "no permission" position, honestly**
- *Weakness exploited:* SMS apps need broad SMS read access, and the lenders' apps push credit products ([comparison page](https://getfinny.app/blog/sms-expense-tracking-app), low authority).
- *Steps:* (1) Publish a plain "what we never ask for" page. (2) Remove any claim you can't back. Your PDF goes to a server and an LLM host, while Ruply claims on-device. (3) Consider on-device or auto-delete-after-analysis processing as the real differentiator.
- *Outcome:* A defensible trust claim.

**Strategy 3: Out-niche the generalists**
- *Weakness exploited:* Money View and Axio are lenders. Their incentive is credit sales, not neutral analysis.
- *Steps:* (1) Pick one job: freelancer or small-seller "UPI income and expense report for tax filing". (2) Output a CSV/PDF a CA can use. (3) Sell it per-report.
- *Outcome (hypothesis):* A clearer paid use case than "see your spending".

### 2.4 Predicted next moves

| Prediction | Confidence | Signals | Implication |
|---|---|---|---|
| Google widens Ask Google Pay to all users and adds budgets or alerts | Medium | Limited rollout announced Jul 2026; Gemini integration is a stated strategy | Anything single-app and "chat about your spending" gets commoditized. Don't compete there |
| Paytm and PhonePe copy the AI assistant | Medium | Paytm already has Spend Summary and tags; PhonePe holds the richest data (PulsePro shows it already monetizes aggregates) | Window for the single-app wedge is closing |
| Lenders keep bundling tracking with credit | High | Money View's pivot; Axio's NBFC parent | Neutrality is your angle |

### 2.5 Information gaps
Ask Google Pay eligibility and limits; Ruply pricing and traction; Play Store reviews of Walnut/Axio/Fold; Reddit thread counts; Google Trends curves for "UPI expense tracker". To fill: Play Store review export, Reddit search by hand, Google Trends, Meta Ads Library.

## 3. Strategic Planning: 3 highest-impact next moves
*Assumptions: solo or tiny team; no users; no revenue; goal is to find out if this is a business within about 6 weeks.*

**Move 1: Run a concierge validation (next 14 days).** Get 15 real people to send you a statement. Hand-deliver the insight screen or a PDF report. Measure: how many send a second month, and who asks "can I pay for this?" Kill rule: fewer than 5 of 15 come back for a second statement, or no one will pay even ₹99.

**Move 2: Fix the one thing that decides retention.** Right now a user uploads once and leaves. Pick one repeat hook and test it: monthly "add this month" reminder, recurring-bill calendar, or shareable year-end summary. Don't build all three.

**Move 3: Widen input before widening features.** Add PhonePe and Paytm statements. Google Pay-only is about a third of UPI by transactions.

**Priority:** 1 → 3 → 2. Don't build anything new until Move 1 returns data.
**Success criteria:** 15 statements collected, 5 returning users, 3 stated willingness to pay with a number.

## 4. Go-to-Market (go-to-market-plan skill)

**Strategy 1: Community-led concierge.** Offer free analysis to people in r/PersonalFinanceIndia, r/IndiaInvestments and similar. Reply to threads where someone asks for a UPI tracker. Never spam; answer the question, mention the tool once. Target: 30 statements.

**Strategy 2: "UPI Wrapped" shareable.** A clean, shareable summary card (top merchants, biggest month, "you paid 41 different people"). Time it for the Dec-Jan new-year budgeting window. Shareability is the only organic distribution loop that fits a one-shot-use product.

**Strategy 3: Niche partnership, freelancers and CAs.** Offer a tax-season "UPI income report" to a few chartered accountants for their small clients. Slower, but the buyer has money and a deadline.

**Execution order:** 1 now, 2 in December, 3 only if Move 1 shows freelancers paying.
**Honest caveat:** Play Store ASO is unproven here. I could not pull keyword popularity or difficulty, so don't plan around it.

## 5. Pricing Strategy (pricing-strategist skill)
*All prices are hypotheses to test. I found no sourced willingness-to-pay data for Indian consumers. [BillCut](https://www.billcut.com/blogs/fintech-subscription-models-in-india-how-they-monetise) only offers vendor-blog assertions, and INDmoney's paid tier sells advice, not analytics.*

| Tier | Hypothesis | Why |
|---|---|---|
| Free | 1 statement, full overview | Matches the zero-cost competitors; lets people see value before paying |
| One-off report | ₹99-199 per tax-year or per 12-month report | Fits a one-shot use pattern better than a subscription |
| Pro (only if retention is proven) | ₹49-99/month for multi-period history, multi-app merge, alerts | Subscription only makes sense if people return monthly |

**Biggest pricing risk:** Free open-source and bundled in-app tools set the price anchor at zero. Don't launch a subscription before the repeat-use data exists.

## 6. Marketing Ideas, Top 5 (marketing-ideas skill)
1. **UPI Wrapped card.** Shareable end-of-year summary. Low cost, built-in virality.
2. **Free "statement x-ray" in public.** Offer to analyze people's statements on request. Posts are the content.
3. **Programmatic SEO pages** for "export Google Pay statement PDF", "how to read UPI statement". People who search that already have the file. I could not measure volume; test cheaply.
4. **Privacy-comparison page.** "What each tracker reads: SMS, OTP, accessibility, PDF only". Honest and linkable, but only after you've fixed your own privacy claim (see §10).
5. **Tax-season landing page** for freelancers (Jan-Mar), driving to the one-off report.

## 7. PRD (prd-generator skill): what is missing for a startup PRD
Your `PRD.md` is a good engineering PRD. For a startup it lacks:
- **A named hypothesis and kill criteria** (see §3, Move 1).
- **A competitor section** (use §2 above).
- **Pricing and monetization** (use §5; currently none).
- **Retention mechanics** (currently the "second period" metric has no feature behind it).
- **Input roadmap:** PhonePe, Paytm, bank PDFs.
- **A privacy specification that matches reality** (server upload and LLM host vs. the "private by default" wording).
- **Instrumentation**, which the PRD admits does not exist.
The skill outputs a PDF for AI coding tools. I did not generate one, because rewriting the PRD before validation would add polish, not information.

## 8. CRO Audit of `landing-page/` (cro-optimization skill)
*Audited from source (`src/app/page.tsx` and components), not a live URL. No analytics or traffic available.*

**What's working:** One clear CTA ("Get early access"), real app mockups, an FAQ, and a privacy policy page.

**Critical issues:**
1. **Headline overpromises and is vague.** "A second set of eyes on every transaction you make" and "categorized the moment it lands" describe live monitoring. The product analyzes an uploaded PDF. Visitors expecting real-time tracking will bounce or feel misled. This is also an honesty problem.
2. **It never says what it works with.** No mention of Google Pay, UPI, India or PDF. A visitor can't tell if it's for them.
3. **"Gets more confident the longer it watches"** implies passive monitoring that doesn't exist.
4. **No proof.** No user count, no testimonial, no sample output with fake data.
5. **The scaffold is a template.** Component paths come from `becomeautonomous-com-...`. Check nothing from the source site's copy or branding remains.
6. **Contact address `hello@atg.science`** doesn't match the Miravelt brand. Confirm it is intentional.

**Fixes:** Rewrite the hero to "Upload your Google Pay statement. See where the money went." Show a sample overview. Add a "what we do and don't access" strip. Keep one CTA and add a signup counter once you have real numbers.

## 9. Copy Skills

### 9.1 Brand copy (brand-copywriter), landing hero, two frameworks
**AIDA:** *Six months of UPI payments. Zero idea where it went.* Drop in your Google Pay statement PDF. In about a minute you'll see what came in, what went out, what repeats and what looks unusual. No bank login. No SMS access. [See my spending]
**PAS:** *Your Google Pay history is a wall of "Paid to…" lines. Every budgeting app wants your bank login or your SMS inbox. Miravelt reads the PDF you already have.* [Try it with one statement]
*Recommendation:* AIDA for the hero, PAS for ads. Only run the "no SMS access" line once the privacy claims are verified (§10).

### 9.2 Viral hooks (viral-hook-creator)
- *Data-driven:* "I let an app read 6 months of my GPay. 41% of my money went to people, not shops."
- *Contrarian:* "Budgeting apps don't need your bank login. They need a PDF you already have."
- *Curiosity:* "Where did ₹1.2 lakh of UPI go? The answer had 3 words in it."
(The statistics in these examples are placeholders for illustration. Use real, user-consented numbers only.)

### 9.3 X posts (x-writer), three
1. **One-liner:** Your Google Pay statement has the answer to "where did my money go". Nobody reads it.
2. **Comparison:** SMS trackers: read every text you get. Bank-sync apps: want your OTP. Statement-based: read one PDF you choose.
3. **Progression:** 1) Export your GPay statement. 2) Drop it in. 3) See your top merchants, recurring payments and unusual spends. 4) Delete it. (Only post step 4 if auto-delete is real.)

### 9.4 LinkedIn posts (linkedin-writer), two
- **Lessons learned:** "I built a 15-stage ML pipeline for a PDF analyzer before talking to a single user. Here's what that cost me, and what I'd do first next time." (Honest builder story. Likely your best-performing format, since it is true.)
- **Hot take:** "The best finance app for Indian UPI users might not be an app, it might be a monthly report."

### 9.5 Lead magnet (lead-magnet-generator)
**"The UPI Statement Cheat Sheet"**, how to export statements from Google Pay, PhonePe and Paytm and what each column means. Drives comments and DMs and doubles as SEO content. *Version 1 (quick):* "Comment STATEMENT and I'll send the 3-app export guide." *Version 2 (detailed):* the same, with 5 bullets on what a statement hides.

### 9.6 Outreach (outreach-specialist)
**Target:** freelancers and small sellers who take UPI. **Channel:** LinkedIn DM and warm intros. Drafted, not sent. Sending is your call.
1. *Initial:* "Hi [name], do you pull your UPI statements for tax time? I'm testing a tool that turns them into a clean income/expense report and want 10 freelancers to try it free. Worth a look?"
2. *Follow-up (3 days):* "No pressure. Would a sample report help you decide?"
3. *Final (7 days):* "Closing the loop. If it ever becomes useful, I'm here."

## 10. Honest problems the skills surfaced
1. **Privacy claim vs reality.** The PRD says "private by default", but the PDF goes to your backend and an LLM on your own host. Ruply says it keeps data on device. If privacy is the differentiator, it must be literally true. Either process locally or auto-delete and say so precisely.
2. **The homepage describes a different product** (live monitoring) from the one you built (statement upload).
3. **Engineering scope vs. evidence.** The project has depth (clustering, graphs, memory states) with no demand data. Every month spent there is a month not spent on Move 1.

## 11. Product Hunt Launch (product-hunt-launch-plan)
**Not recommended yet.** Product Hunt skews to global tech-and-indie audiences; your user is an Indian UPI consumer on Android. A launch would give vanity upvotes, not users, and you have no Play listing, no deletion flow and no public product. Revisit after 100+ real users, as a credibility and backlink play, not a growth channel. **Better first venues:** Indian personal-finance subreddits and communities, X India fintech, and Indie Hackers.

## 12. SOP (sop-creator): "Concierge statement analysis (validation phase)"
1. **Purpose:** Deliver value to the first 15 testers manually and capture signal.
2. **Who:** Founder.
3. **Steps:** (1) Recruit via community reply or DM and get explicit consent. (2) Person exports a statement and sends it. (3) Run it through the app. (4) Send back 3 screenshots plus 3 sentences. (5) Delete the statement and confirm to the user. (6) Log in a sheet: source, date, reaction, "would pay?", second-month yes/no. (7) After 30 days, ask for the next month.
4. **Quality check:** Every tester got a deletion confirmation; no statement leaves your control.
5. **Common problems:** Wrong PDF type (use the rejection guide), password-protected PDFs, categories wrong (record the correction rate, it is a product metric).

## 13. The Next 14 Days
1. Fix the landing page hero and add a sample screen (§8).
2. Verify and fix the privacy wording (§10.1).
3. Recruit 15 testers using the Strategy-1 GTM and the outreach drafts. You send, I don't.
4. Run the SOP. Track returns and payment intent.
5. **Decision at day 14:** at least 5 of 15 return for month two, or at least 3 name a price, so continue. Otherwise change the niche (freelancer reports or multi-app consolidation) or stop. Don't rescue it with features.

## 14. Final honest summary
- **Strong:** a real working product, a sharp pitch, a privacy angle, an honest-uncertainty philosophy.
- **Missing:** a validated user, a price, a retention loop, multi-app input, evidence of distribution.
- **New threat:** Google built the core experience into its own app this summer.
- **Best bet:** a neutral cross-app consolidator or a freelancer-tax report, tested with real people in two weeks, before any new feature.

*Research limits: no Sensor Tower, Similarweb, Google Trends, Meta Ads Library, Play Store reviews or direct Reddit access. Treat §2 as a starting point, not a finished competitive analysis.*
