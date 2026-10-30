# Yell AI — Evaluation & Launch Plan

**Written:** 2026-10-30 · **Status:** proposal, needs founder decisions at Gate 0

---

## Part 1 — Evaluation

### Verdict

**Don't launch the current shape** (general-purpose "India Super-Agent" on WhatsApp, paid for by in-chat brand ads + ₹99 Pro).
**Do launch a narrow, paid wedge** built from what already exists: WhatsApp UX + Composio Gmail + UPI billing.

Three facts kill the current shape:

1. **The platform bans it.** Meta's WhatsApp Business terms have barred general-purpose AI assistants since 15 Jan 2026. ChatGPT and Copilot left WhatsApp. Meta reopened access, for a fee, only where regulators forced it (Italy, Brazil, EU/EEA). An India reversal is claimed by one blog and is **unverified**. Yell's own intent prompt calls it a *"WhatsApp AI Super-Agent"*, which is the banned category.
2. **Every reply now costs money, and ads don't cover it.** Since 1 Oct 2026 Meta charges ~₹0.115 + GST per service message in India (first 1,000/month per number free). The ad model loses money per message even with the spreadsheet's own optimistic numbers (table below).
3. **You can't compete on "AI in WhatsApp".** Meta AI is built into WhatsApp and free. ChatGPT Go is free for 12 months in India, Jio users get Gemini Pro free, and Puch AI (9090909090) is free and voice-first. A general assistant has no wedge.

### The math (per WhatsApp reply)

| | Spreadsheet assumption | Reality (Oct 2026) |
|---|---|---|
| Meta fee | ₹0.35 per 24h window, unlimited msgs | ~₹0.115 **per reply** (+GST) |
| LLM cost | ₹0.0075 (400 tokens) | ~₹0.03 (agent + memory + tool schemas, estimate) |
| **Cost per reply** | ~₹0.01 | **~₹0.145** |
| Ad revenue per reply | 30% density × ₹350 CPM = ₹0.105 | 20% density × ₹80 CPM × 30% fill ≈ **₹0.005** |
| Msgs/user/day | 100 | Realistic engaged user: 5–15 |

What that means with the limits in `backend/app/config.py`:

| User | Monthly cost | Monthly revenue |
|---|---|---|
| Free user at cap (`FREE_DAILY_LIMIT=25`) | ~₹109 | ₹79 (sheet) / **~₹4 (realistic)** |
| Pro user at cap (`PAID_DAILY_LIMIT=1000`) | **~₹4,350** | ₹99 → ~₹82 net after GST + Razorpay |
| Pro break-even | — | **~19 replies/day** |

The 12-month forecast's Month 12 implies **₹315 ad revenue per DAU per month**. That is several times what Meta itself earns per user in Asia-Pacific. Nobody pays a new ad network that CPM.

> Spreadsheet note: `Yell_AI_Business_Plan_Financial_Model.xlsx` has formulas but no cached values. Most totals show **0** outside Excel.

### Scorecard

| Dimension | Score | Why |
|---|---|---|
| Problem pain | 2/5 | "AI assistant in WhatsApp" is nice-to-have. Free options exist. |
| Reach | 5/5 | WhatsApp is where India lives. |
| Platform risk | 1/5 | Meta controls access, pricing, and is a direct competitor (Meta AI). |
| Unit economics | 1/5 | Negative per message as currently priced/capped. |
| Differentiation | 1/5 | Meta AI, ChatGPT Go, Gemini, Puch AI are all free. |
| Build readiness | 3/5 | Lots of code; end-to-end flow not verified (see `READINESS.md`). |
| Focus | 1/5 | Repo tells 3 stories: super-agent, NanoClaw launcher, and SMB review tool (`socials.MD`). |

### SWOT (current shape)

| Strengths | Weaknesses |
|---|---|
| Working WhatsApp webhook + Gemini + Razorpay | No single job-to-be-done |
| Composio 1-tap Gmail/Calendar/Notion connectors | Ad model needs ~100k+ DAU to matter |
| UPI checkout, Hindi/India-native framing | Unverified end-to-end; two deployment tracks |

| Opportunities | Threats |
|---|---|
| Tasks Meta AI can't do (act on your Gmail, outreach) | Meta ban on general AI assistants |
| "Business service that uses WhatsApp" is an allowed category | Per-message fees since Oct 2026 |
| India job market: huge, painful, UPI-payable | Free AI everywhere in India |

### Competitors

| | Price in India | On WhatsApp? | What it can't do |
|---|---|---|---|
| Meta AI | Free | Built in | Act on your Gmail/Calendar; outreach |
| ChatGPT | Go free for 12 months | Left Jan 2026 | Live in WhatsApp |
| Gemini | Pro free for Jio users | No | Live in WhatsApp |
| Puch AI | Free | Yes (9090909090) | Paid outcomes; deep tool actions |
| Naukri / LinkedIn Premium / Instahyre | ₹500–2,000+/mo | No | Direct founder outreach done for you |

### What to keep, cut, shelve

- **Keep:** WhatsApp front door, Composio Gmail, Razorpay/UPI, usage limits, memory.
- **Shelve:** Brand Ads portal + ad engine (revisit only after 50k MAU), IRCTC/food/finance intents, NanoClaw launcher track.
- **Cut from messaging:** "Super-agent", "Instinct + Poke clone", "India's #1".

---

## Part 2 — The wedge

**Recommended wedge: "Backdoor": an AI job-outreach service on WhatsApp.**
The user shares a resume and target roles. Yell finds relevant Indian/YC startup founders, drafts short personal cold emails, and the user approves them in WhatsApp with one tap. Emails go out from the user's own Gmail. Replies and interviews are tracked.

Why this one:
- **Already in the code:** `founder_outreach` intent and agent prompt, Composio Gmail.
- **Meta AI can't do it.** It needs the user's Gmail and real sending.
- **A business service, not a chatbot.** WhatsApp carries approvals and status updates, and the AI work happens off-WhatsApp. That is the safer side of Meta's policy and needs about 30–50 messages per sprint, not 3,000/month.
- **People pay for outcomes.** "Interviews" is worth paying for. "Chat" isn't.

Pricing to test: **free first 5 emails → ₹299 per 14-day sprint (up to 50 founder emails)**. Drop the always-on ₹99/month plan.

### Primary persona: "Arjun", 21–27

- Fresher or 1–3 years of experience, often from a tier-2/3 college. Applies on Naukri/LinkedIn and hears nothing back.
- Lives on WhatsApp. Pays by UPI. Spends ₹100–500 on things that might get a job (courses, resume reviews, LinkedIn Premium trials).
- **Pain:** "I've applied to 200 jobs and got 2 calls." **Job:** get interviews at startups without a referral.
- **Channels:** r/developersIndia, LinkedIn, college WhatsApp/Telegram groups, career creators on Instagram/YouTube, Topmate.

**Anti-persona:** senior leaders (they use recruiters), and people who want a general chatbot (send them to Meta AI).

### Brand

Pick the name before Gate 1 so beta users save the right contact. The WhatsApp contact name *is* the brand.
Shortlist and reasoning are in the chat reply. Default: **Tara**, after a trademark (IP India, classes 9/35/42) and domain check.

---

## Part 3 — Launch plan

### Gate 0 — De-risk (2–8 Nov 2026)

Nothing ships until all of these are done.

| # | Task | Owner | Done when |
|---|---|---|---|
| 0.1 | Ask Kapso (BSP) and Meta in writing: is "job-outreach service using AI, with WhatsApp for approvals/updates" allowed for an Indian number under current Business Solution Terms? | Founder | Written answer saved |
| 0.2 | Pick the wedge (default: Backdoor) and the name | Founder | Decision logged in this file |
| 0.3 | Fix the money leak: `PAID_DAILY_LIMIT` 1000 → 40; free tier = 5 outreach emails, not 25 chats/day | Eng | Deployed |
| 0.4 | Rewrite the intent system prompt: remove "Super-Agent"; describe a job-outreach service | Eng | Deployed |
| 0.5 | Turn off ad cards and unused intents (IRCTC, food, budget) | Eng | Deployed |
| 0.6 | Fallback channel if 0.1 is "no": the web app at yellapp (Firebase OTP already built) + Telegram. Don't use unofficial WhatsApp Web clients (NanoClaw/Baileys) commercially; numbers get banned. | Eng | Fallback path decided |

### Phase 1 — Concierge validation (9–22 Nov)

Goal: prove that people pay and that founders reply. Doing things by hand is fine.

- Recruit **30 users** from your network, 2–3 college groups, and one r/developersIndia post ("I'll cold-email 20 founders for you, free").
- Run the full flow end to end: resume → founder list → drafts → WhatsApp approval → Gmail send → reply tracking. Finish the P0.4 checks in `READINESS.md` along the way.
- Do the founder-finding by hand where needed (Wellfound, YC directory, LinkedIn). Automate only what repeats.
- At day 7 of each user's sprint, ask them to pay ₹299 for the next sprint.

**Go / no-go on 22 Nov:**

| Metric | Go | Kill or rethink |
|---|---|---|
| Founder reply rate on sent emails | ≥ 6% | < 3% |
| Users with ≥ 1 interview | ≥ 25% | < 10% |
| Paid for a second sprint | ≥ 8 of 30 | < 3 of 30 |

### Phase 2 — Private beta (23 Nov – 20 Dec)

Goal: 200 users, mostly via referral, at positive unit economics.

- **Product:** automate founder discovery and drafting; add a daily WhatsApp summary ("12 sent · 2 replies · 1 interview"); Razorpay ₹299 sprint checkout inside the chat.
- **Growth loop:** a user who gets an interview shares a screenshot and earns a free sprint for each friend who pays. Every interview screenshot becomes a LinkedIn/Instagram post (with consent).
- **Waitlist:** landing page with one CTA ("Get 5 founder intros free"), honest copy, real reply screenshots.
- **Track weekly:** activation (Gmail linked + first batch approved within 24h), reply rate, interviews per sprint, paid conversion, cost per sprint.
- **Unit economics target:** cost per sprint (WhatsApp + LLM + email-finding API + Gmail) **≤ ₹60** against ₹299 revenue.

### Phase 3 — Public launch (5–31 Jan 2027)

Time it for January off-campus hiring and new-year job-switch intent.

| Week | Moves |
|---|---|
| 5 Jan | r/developersIndia + LinkedIn founder story with real numbers ("200 users, X interviews") |
| 12 Jan | 10 campus ambassadors (free sprints + ₹50 per paid referral) in tier-2/3 engineering colleges |
| 19 Jan | 3–5 career creators (Instagram/YouTube): paid per signup, not flat fee |
| 26 Jan | Product Hunt (for credibility, not volume); press pitch to YourStory/Inc42 with the outcome data |

**January targets:** 2,000 signups · 25% activation · 300 paid sprints (~₹90k revenue) · referral share ≥ 30% of signups.

### After launch (Feb – Apr 2027)

- Prepare for the April–June job-switch wave that follows appraisal season.
- Next product steps only if January targets hold: referral requests to employees (not just founders), interview prep in WhatsApp, recruiter-side "verified candidate" product (B2B revenue).
- Revisit brand ads only at 50k+ MAU, and only as "sponsored roles" from hiring startups, which fits the product instead of interrupting it.

### Budget to January (estimate)

| Item | ₹ |
|---|---|
| WhatsApp messages (~500 users × 50 msgs) | ~3,000 |
| LLM | ~5,000 |
| Email-finding API | ~15,000 |
| Creators + ambassadors | ~40,000 |
| Domain, trademark filing | ~10,000 |
| **Total** | **~₹75,000** |

### Risks to watch

| Risk | Early signal | Response |
|---|---|---|
| Meta says no / suspends number | BSP warning, template rejections | Move to web app + Telegram (Gate 0.6) |
| Cold emails flagged as spam | Gmail bounces, low open rate | Cap 15 sends/day per user, personalise every email, user approves each one |
| Google OAuth scope review for Gmail send | Composio/Google verification blocks | Use Composio-managed auth; budget for CASA review if self-hosting the OAuth app |
| Low willingness to pay | < 3 of 30 pay in Phase 1 | Try pay-per-interview (₹199 per interview booked) before killing |

---

## Sources

- [TechCrunch — WhatsApp bars general-purpose chatbots (Oct 2025)](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform)
- [TechCrunch — Brazil orders Meta to suspend the policy (Jan 2026)](https://techcrunch.com/2026/01/13/brazil-orders-meta-to-suspend-policy-banning-third-party-ai-chatbots-from-whatsapp)
- [MediaNama — Meta pauses ban where legally required (Mar 2026)](https://www.medianama.com/2026/03/223-meta-pauses-block-ai-chatbots-whatsapp/)
- [Dataconomy — rival AI chatbots allowed in Europe for a fee (Mar 2026)](https://dataconomy.com/2026/03/06/meta-allows-rival-ai-chatbots-on-whatsapp-in-europe-for-a-fee/)
- [Hans India — WhatsApp service messages paid from 1 Oct 2026](https://www.thehansindia.com/tech/whatsapp-business-messages-to-be-paid-from-october-1-india-pricing-explained-1127274)
- [Meta — WhatsApp Business Platform pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md)
- [Croma — Jio Gemini vs Airtel Perplexity vs ChatGPT Go free plans](https://www.croma.com/unboxed/jio-vs-airtel-vs-chatgpt-go)
- [Storyboard18 — Puch AI on 9090909090](https://storyboard18.com/digital/puch-ai-bets-on-indias-most-expensive-mobile-number-to-challenge-chatgpt-and-grok-80124.htm)
- [Exchange4media — India's low CPMs in Meta's ad market](https://www.exchange4media.com/digital-news/metas-ad-prices-rise-14-globally-in-q3-just-1-in-apac-the-india-equation-159408.html)
