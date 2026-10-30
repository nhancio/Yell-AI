# Astra AI compared with Instinct and Poke

Research date: 30 October 2026.

Scope: product capabilities, onboarding, account controls, billing, and implementation readiness. Research only; no application code was changed for this review.

Evidence standard: competitor capabilities below are documented or advertised by the companies, not independently tested. Astra findings come from reading the current hosted FastAPI backend, Next.js pages, and the separate vendored NanoClaw runtime. Production credentials, deployed configuration, paid competitor accounts, and live task completion were not tested. Repository files were changing during the review; code findings describe the snapshot inspected today. Older README and readiness documents were not treated as authoritative where implementation differed.

## Main finding

Astra has messaging, account verification, connector scaffolding, billing, and a polished landing page. Its hosted WhatsApp processing path still generates text without executing connected-app tools. This is the main obstacle to matching a personal assistant that completes tasks.

The immediate goal should be a small set of verifiable outcomes: actually reading an inbox, creating a calendar event, delivering a reminder after the conversation ends, understanding a voice note, and recalling an explicitly saved preference later.

## What the competitors publicly offer

**Instinct** advertises an assistant reachable by text or call that can operate a phone and computer. Its examples include groceries, train booking, flowers, and finding a court. Its privacy policy describes connected applications, Google Workspace access, and actions involving third parties. These establish its intended task-execution scope, but do not establish universal availability, success rates, exact connector coverage, or a particular technical architecture. [Official homepage](https://instinct.com/), [privacy policy](https://instinct.com/privacy-policy).

**Poke** documents email and calendar actions, reminders, web search, several messaging channels, a recipe directory, custom MCP connections, and API-triggered workflows. Its published product also uses memory for proactive assistance. [Welcome](https://poke.com/docs), [product overview](https://poke.com/), [integration management](https://poke.com/docs/managing-integrations), [API](https://poke.com/docs/api).

Poke additionally documents a human concierge tier, assistant email addresses, website publishing, and PDF/chart capabilities. These are useful expansion references, but should follow reliable core tasks. [Release notes](https://poke.com/docs/release-notes), [FAQ](https://poke.com/faq).

## Capability gaps

“Missing” here means not found in the inspected hosted consumer flow. It does not mean the repository contains no reusable component for that capability.

| Capability | Competitor evidence | Astra implementation finding | Priority |
|---|---|---|---|
| Execute email/calendar actions from conversation | Poke documents connected-app actions; Instinct describes Workspace access and acting for users | Composio execution helper exists, but hosted chat does not call it | P0 |
| Complete a request across several apps | Poke API examples describe workflows spanning email, calendar, and integrations | Intent routing produces a reply; no plan/execute/observe loop found | P0 |
| Confirm consequential actions and return proof | Important product requirement for an assistant with external authority; exact competitor approval guarantees were not verified | No durable pending-action/approval state or operation receipt in hosted chat | P0 |
| One-off and recurring reminders | Poke advertises reminders, scheduled tasks, and background automations | No scheduler or reminder model in hosted backend; NanoClaw has scheduling separately | P1 |
| Proactive updates | Poke advertises assistance using connected services and memory | No inbox/calendar event subscriptions or periodic user-monitoring workflow found | P1 |
| Persistent personal context | Poke describes memory as part of its product and account state | Hosted memory stores recent conversation turns, rather than an enduring user knowledge profile | P1 |
| Understand voice notes | Poke advertises tasks from voice messages; Instinct advertises calls | Audio becomes a placeholder or caption; no audio retrieval/transcription in hosted path | P1 |
| Understand screenshots and documents | Poke documents attachment handling and document capabilities | Images/documents become captions or generic text; no content extraction in hosted path | P1 |
| Ground research in current sources | Poke documents web search | Hosted Gemini call supplies text/history without search or grounding tools | P1 |
| Installable, shareable workflows | Poke Kitchen bundles setup context and integrations into share/install links | Homepage recipes are prefilled WhatsApp prompts, not installed automations | P2 |
| Broader connector catalog and custom integrations | Poke documents additional services and MCP servers | Eight declared Composio toolkits; no consumer MCP connection UI or dynamic tool discovery | P2 |
| Alternate messaging channels | Poke documents Apple Messages, WhatsApp, Telegram, RCS | Current hosted backend and contact component expose WhatsApp only | P2, or earlier for distribution resilience |
| Operate websites and complete bookings | Instinct advertises phone/computer operation; Poke offers a paid human service | No hosted browser-control, business-calling, purchasing, or human-dispatch workflow found | P3 |
| Generate deliverables and publish sites | Poke documents these expanded outputs | No hosted consumer generation-and-delivery pipeline found | P3 |

Competitor references for the table: [Poke core capabilities](https://poke.com/docs), [Poke integrations](https://poke.com/docs/managing-integrations), [Poke recipes](https://poke.com/docs/creating-recipes), [MCP servers](https://poke.com/docs/mcp-servers), [Poke API](https://poke.com/docs/api), [Poke product](https://poke.com/), [Poke release notes](https://poke.com/docs/release-notes), [Instinct](https://instinct.com/), [Instinct connected-data description](https://instinct.com/privacy-policy).

## Specific findings in Astra

### 1. Linking an account does not yet enable task execution through chat

In `backend/app/routes/webhook.py`, the conversation path loads account connections, passes their names to the orchestrator, generates a response, and sends that response. `backend/app/agents/tasks.py` calls the Gemini text-generation service. `backend/app/services/gemini.py` supplies no function declarations, search tool, or connected-tool execution loop.

`ComposioService.execute_action` exists in `backend/app/services/composio_service.py` and has a direct endpoint in `backend/app/routes/connectors.py`. Searching its callers found that endpoint, not the hosted conversational path. This is useful infrastructure, but its presence does not establish that texting “send this email” sends anything.

The same issue affects inbox summaries, live PNR checks, receipt totals, founder research, and Notion updates. Their factual execution requires retrieved data or confirmed external actions. A generated confirmation is insufficient evidence.

### 2. Current backend scope conflicts with the broad assistant presentation

The inspected intent classifier and general-help prompt explicitly describe a job-outreach service. The general-help instructions redirect requests unrelated to job hunting. The landing page still describes a general everyday assistant, including travel, expenses, and notes.

A narrow outreach product is a legitimate direction, but it is a different product scope from broad Instinct/Poke parity. The proposal in `LAUNCH_PLAN.md` should not be confused with proof of an approved direction or current platform eligibility.

### 3. Media messages are acknowledged without understanding their contents

In `backend/app/services/whatsapp.py`, audio, image, video, and document messages yield captions or placeholders. The parser does not retain a media identifier for retrieval in the returned message object. The webhook then forwards text to the orchestrator.

Receiving an audio message therefore does not establish voice understanding. Required outcomes include transcription with language detection, screenshot/OCR extraction, document parsing, and a usable error when a file cannot be processed.

### 4. Hosted memory is limited

`backend/app/services/memory.py` retrieves ten recent turns by default, retains up to fifty, and sets the Redis key to expire after 24 hours of inactivity. Its process-local fallback does not survive restarts. Repeated messages can renew the Redis TTL, so this is not a claim that every conversation is deleted exactly 24 hours after it begins.

The user model includes some profile fields, but the inspected chat flow does not demonstrate durable preference learning, searchable personal knowledge, or user-managed saved memories. A conversation database model alone does not establish that the active path uses it for long-term recall.

### 5. Connection state and account controls need stronger guarantees

The authenticated `/api/me` routes use Firebase-verified phone identity. Separate legacy connector routes accept a supplied phone number without the same dependency. The legacy confirmation route marks an account active, and the connect page includes a fallback that invokes this confirmation when no real external authorization link is returned.

Connection status should reflect provider-confirmed authorization. The consumer flow also needs disconnect/revoke, expired-token recovery, permission visibility, and deletion of stored user data. Poke documents disconnect/reconnect and account deletion; Instinct documents revocation and deletion controls. [Poke integration controls](https://poke.com/docs/managing-integrations), [Poke account deletion](https://poke.com/faq), [Instinct controls](https://instinct.com/privacy-policy).

### 6. Background processing does not establish reliable follow-through

The hosted webhook uses FastAPI in-process background tasks and an in-process message-deduplication cache. No durable task lifecycle with restart recovery, persistent retries, cancellation, or task receipts was found in the inspected backend.

A useful consumer-facing lifecycle would show accepted, awaiting approval, running, completed, or failed, with an actual event/message/document identifier where applicable. This is a recommendation for Astra, not a claim about competitors' private infrastructure.

### 7. Onboarding and commercial promises are inconsistent

- Homepage WhatsApp number: `15552107308`. Connect page and channel configuration default: `12057820175`. The intended live number was not verified.
- Homepage describes 25 free requests and 1,000 Pro actions daily. Current configuration defaults are 10 and 40. Deployment environment variables could override these values; live limits were not verified.
- Homepage describes an ad-supported free plan. Current configuration defaults disable ads.
- The payment service creates a payment link for a 30-day pass. Automatic recurring renewal/UPI mandate management was not established by that implementation, despite Autopay language on the homepage.
- The 24 decorative integration icons are not proof of 24 supported or functioning connectors. The declared backend catalog contains eight toolkits.

These mismatches should be resolved before measuring onboarding conversion or promising parity.

## Useful foundations already present

The repository already contains WhatsApp transport through Kapso/Meta, Firebase phone login, connected-account records and OAuth scaffolding, a Composio execution helper, usage tracking, Razorpay payment links, and account/usage UI. These are implementation foundations, not independently verified production outcomes.

The separate NanoClaw runtime includes recurring/one-off scheduling, persistent task records, filesystem context, web tools, container execution, and session handling. It should be evaluated as reusable infrastructure. Its features should not be advertised as hosted Astra capabilities until they are connected to the same verified user identity, permissions, billing, and delivery path. Current application pages do not expose the old local-launcher onboarding described in stale readiness notes.

## Recommended order

1. Align product scope, live contact destination, plan allowances, and connection state. Validate the messaging distribution route.
2. Prove Gmail and Calendar execution with approvals and external operation receipts. Add live search for research tasks.
3. Deliver durable reminders and preference memory. Provide pause, edit, cancel, forget, and timezone controls.
4. Add genuine voice-note and document understanding, then proactive briefings and follow-ups.
5. Turn a few successful workflows into installable recipes. Add alternate channels and selected integrations according to demand.
6. Evaluate browser-operated bookings, phone tasks, human assistance, and website/file generation only after the core assistant is reliable.

Suggested first acceptance scenarios: retrieve and summarize actual recent emails; create and subsequently retrieve a real calendar event after approval; deliver a reminder after a worker restart; transcribe a Hindi/Hinglish voice note; extract a shared receipt; recall an explicitly saved preference after a new session; stop an automation on request; report a disconnected account accurately. Measure completion using external evidence, time to result, failure recovery, and cost per completed task.

## WhatsApp distribution and pricing uncertainty

The existing launch proposal contains strong assertions about AI-provider restrictions and per-reply charges. They should not be accepted solely because they appear in a local document.

Follow-up verification on 30 October 2026 found a more specific official update: Meta's FAQ explicitly states that service messages became chargeable on 1 October 2026 after the first 1,000 service messages per business phone number each month. That allowance is shared across customers using that number. The general pricing page still describes free service messages, so it should not have been the basis for questioning the dated change. The FAQ establishes the change; fetching the linked primary rate card required login, so the exact India tariff was not independently verified from that card. [Official FAQ](https://whatsappbusiness.com/resources/faq/), [general pricing page](https://whatsappbusiness.com/products/platform-pricing/).

Its messaging policy requires approved templates outside the customer-service window. Astra's inspected sender has no template-message workflow, which is a concrete gap for scheduled notifications. AI-provider rules and special pricing are separate from ordinary business pricing. [Official messaging policy](https://whatsappbusiness.com/policy/).

The public terms index points to the current Meta platform contract, but fetching that contract redirected to a Facebook login/block page during this research. Indexed earlier official terms contain AI-provider restrictions and regional exceptions. Current India-specific eligibility and special AI-provider pricing were not fully verified. Confirm these with Meta/Kapso before committing to a general-purpose, WhatsApp-only launch; another assistant advertising WhatsApp access does not establish Astra's eligibility. Narrowing a prompt alone does not establish compliance. [Official terms index](https://whatsappbusiness.com/terms-and-conditions/).

Poke lists Free, Pro at $19/month, and Ultra at $199/month; its usage documentation describes lighter operation when allowances run out. Astra can choose different pricing, but a ₹99 promise of large autonomous-task allowances needs measured model, tool, messaging, infrastructure, and support costs. No margin conclusion is made here without those measurements. Instinct's current public pricing was not verified. [Poke pricing](https://poke.com/pricing), [usage behavior](https://poke.com/docs/usage-and-resets).

For sensitivity analysis only, assuming an effective variable cost of ₹0.145 per delivered reply and ignoring the shared free allowance: 10 replies/day cost ₹43.50 per 30-day month; 20 cost ₹87; 40 cost ₹174; and 1,000 cost ₹4,350. If ₹82 of revenue is available to cover those costs, the ceiling is approximately 565 replies/month, or 18.85/day, before fixed costs, support, and acquisition. These are conditional calculations, not measured costs or validated tax treatment. Advertising CPM, fill, and revenue assumptions likewise require evidence from paid campaigns.
