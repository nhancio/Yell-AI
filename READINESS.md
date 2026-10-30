# Astra AI — Current State and Execution Backlog

**Updated:** 2026-04-09
**Repo:** `/Users/nithi/Desktop/Claude-Projects/Nhancio-projects/Astra AI`

## 1. What this repo actually contains

This repository currently holds **two related but different product tracks**:

### Track A: Astra AI backend
- Python/FastAPI WhatsApp assistant backend
- Receives WhatsApp webhooks
- Classifies emotion and intent
- Generates replies with Gemini
- Tracks usage and premium status
- Creates Razorpay payment links
- Exposes admin stats and flow logs

Relevant code:
- `backend/app/main.py`
- `backend/app/routes/webhook.py`
- `backend/app/routes/payment.py`
- `backend/app/routes/admin.py`
- `backend/app/services/whatsapp.py`
- `backend/app/services/gemini.py`
- `backend/app/services/memory.py`
- `backend/app/services/usage.py`
- `backend/app/services/payment.py`

### Track B: Astra AI frontend / NanoClaw launcher
- Next.js app with Google sign-in
- Creates per-user local NanoClaw runtimes
- Starts WhatsApp auth locally
- Surfaces QR in the browser
- Registers the user's self-chat
- Starts the NanoClaw bot process
- Stores deployment state and logs in Prisma/SQLite

Relevant code:
- `frontend/src/app/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/DashboardSteps.tsx`
- `frontend/src/components/DeploymentCard.tsx`
- `frontend/src/app/api/deploy/route.ts`
- `frontend/src/app/api/deployments/route.ts`
- `frontend/src/app/api/deployments/[id]/qr/route.ts`
- `frontend/src/app/api/deployments/[id]/logs/route.ts`
- `frontend/src/lib/nanoclaw/localDeployment.ts`
- `frontend/prisma/schema.prisma`

### Runtime dependency inside the repo
- `nanoclaw/` is checked in directly
- It already includes a WhatsApp channel implementation

Relevant code:
- `nanoclaw/src/channels/whatsapp.ts`

## 2. What is already done

### Backend: implemented
- FastAPI app bootstrapping exists
- WhatsApp webhook verification and message handling exist
- WhatsApp send/mark-read service exists
- Kapso and Meta provider support exist
- Gemini integration exists
- Emotion, intent, and task orchestration exists
- Redis-backed memory with fallback exists
- Usage enforcement exists
- Razorpay payment link flow exists
- Admin stats and recent flow APIs exist
- SQLAlchemy models and DB initialization exist
- Docker/Vercel config exists

### Frontend: implemented
- Next.js app shell exists
- Google OAuth with NextAuth exists
- Prisma schema exists
- Dashboard exists
- Deployment list, QR endpoint, and log endpoint exist
- Local NanoClaw runtime creation exists
- WhatsApp auth bootstrap exists
- Self-chat registration exists
- Local bot process startup exists

### NanoClaw integration: implemented
- Repo-local NanoClaw runtime is wired into the frontend flow
- WhatsApp support is already present in NanoClaw
- QR-to-auth-to-bot flow is implemented in code

## 3. What is not aligned yet

These are the main gaps between the codebase and the intended product:

### 3.1 Product scope is still mixed
- The backend is a hosted WhatsApp AI product.
- The frontend is a local/self-host NanoClaw launcher.
- The repo does not yet present one clear primary product story.

### 3.2 Documentation is stale
- Older notes refer to `myclaw/`, static landing pages, and flows that do not match this repo.
- The current frontend README mixes local NanoClaw behavior with older EC2-style deployment language.
- `AGENTS.md` points to `RTK.md`, but `RTK.md` is not present in this repository.

### 3.3 Frontend onboarding is thinner than the docs imply
- The current dashboard only collects `assistantName`.
- It does **not** currently collect:
  - AI provider
  - user AI API key
  - WhatsApp Business credentials
  - provider selection between Kapso and Meta
- Some Prisma fields and config API paths suggest a broader hosted deployment plan, but the current `/api/deploy` route uses the local deployment path only.

### 3.4 Two deployment models exist, but only one is wired
- Local deployment is actively used by `frontend/src/app/api/deploy/route.ts`.
- EC2 deployment code exists under `frontend/src/lib/deploy/`, but it is not the active path for the current dashboard flow.
- This creates confusion about the real MVP.

### 3.5 End-to-end verification is still missing
- Code exists for the core flows.
- This repo still needs full runtime verification:
  - sign in
  - create deployment
  - generate QR
  - authenticate WhatsApp
  - start NanoClaw bot
  - receive and answer messages
  - enforce limits
  - trigger payment flow

## 4. Recommended product decision

Before adding more code, choose one of these as the primary direction:

### Option A: Ship the hosted Astra AI WhatsApp bot first
Focus on:
- `backend/`
- one simple landing/admin surface
- real WhatsApp Business credentials
- production webhook deployment
- payments and support flows

Why this is better now:
- It is closer to a sellable product
- It removes local Docker/NanoClaw setup from the user journey
- It aligns better with the India WhatsApp-first pitch

### Option B: Ship the self-serve NanoClaw launcher first
Focus on:
- `frontend/`
- repo-local NanoClaw runtime
- QR onboarding
- local bot startup reliability

Why this is harder:
- User machine prerequisites matter
- Docker access is required
- local process management is fragile
- hosted business logic in `backend/` becomes secondary

### Recommended choice
**Choose Option A first** unless the goal is explicitly a developer/self-hosting product.

## 5. Concrete backlog

## P0 — Must do next

### P0.1 Decide the primary product
Owner: product/founder

Decide whether this repo is primarily:
- a hosted WhatsApp AI product, or
- a local/self-host NanoClaw launcher

Without this decision, the repo will keep drifting in two directions.

### P0.2 Make documentation truthful
Owner: engineering

Tasks:
- Update `frontend/README.md` to describe the current local deployment flow accurately
- Remove stale references to `myclaw/`, EC2-first assumptions, and unsupported UI inputs
- Add one top-level README later if this repo is going to be shared
- Fix the missing `RTK.md` reference in `AGENTS.md`, or replace it with a real local instruction file

### P0.3 Verify the current local NanoClaw flow end to end
Owner: engineering

Test sequence:
- install frontend deps
- run Prisma generate/push
- sign in with Google
- click Start
- confirm deployment row appears
- confirm QR endpoint returns a real QR
- scan QR in WhatsApp
- confirm bot reaches `ready`
- send `@AssistantName` in self-chat
- verify reply is received

Success criteria:
- no manual terminal steps during onboarding
- logs are visible in UI
- failure states are understandable

### P0.4 Verify the backend WhatsApp bot flow end to end
Owner: engineering

Test sequence:
- configure provider credentials
- expose `/webhook` over HTTPS
- complete Meta/Kapso webhook verification
- send inbound WhatsApp message
- verify memory + orchestration + reply
- verify usage limit behavior
- verify payment link generation

Success criteria:
- webhook verification works
- user message gets a reply
- premium upsell works when limit is reached

## P1 — Important after the product decision

### P1.1 Remove the split-brain deployment story
Owner: engineering

If choosing hosted backend first:
- de-emphasize or archive the local NanoClaw launcher path

If choosing local launcher first:
- remove or clearly label the EC2 code as inactive/future work

### P1.2 Bring frontend data model and UI into sync
Owner: engineering

Current mismatch:
- Prisma `Deployment` includes fields for WhatsApp tokens, provider, AI provider, and AI API key
- Dashboard UI does not collect them
- `/api/deploy/config` assumes those values may exist

Tasks:
- either add those fields to the UI and `/api/deploy`
- or remove/defer them from the active flow

### P1.3 Improve runtime failure handling
Owner: engineering

Tasks:
- better errors when Docker is unavailable
- better errors when Claude credentials are missing
- clearer QR timeout handling
- bot process restart or cleanup strategy
- cleanup for abandoned local runtimes under `frontend/.runtime`

### P1.4 Add one canonical architecture doc
Owner: engineering

Include:
- which app is primary
- how `frontend`, `backend`, and `nanoclaw` relate
- what is production vs MVP vs future work

## P2 — Production hardening

### Backend hardening
- replace default `ADMIN_API_KEY`
- lock down `CORS_ALLOWED_ORIGINS`
- validate all required env vars at startup
- add structured logging and monitoring
- add retries/circuit handling around provider calls
- define data retention for flow logs and conversation memory

### Frontend hardening
- move from SQLite if multi-user production is expected
- stop storing sensitive keys in plain form if user credentials become part of the product
- add deployment cancellation/cleanup support
- add health checks for runtime processes

### Ops hardening
- choose a production host
- wire HTTPS and domain
- decide secrets management
- set up alerting and backups

## 6. Suggested execution order

### If shipping hosted Astra AI backend first
1. Verify backend webhook flow
2. Fix docs to reflect hosted-first product
3. Add or simplify a minimal operator/admin UI
4. Complete payment + support flow
5. Productionize hosting, HTTPS, secrets, and monitoring

### If shipping local NanoClaw launcher first
1. Verify frontend deploy-to-chat flow
2. Fix docs to reflect local-first product
3. Resolve dashboard/data-model mismatch
4. Improve runtime resilience and cleanup
5. Only then revisit EC2 deployment support

## 7. Immediate action items for the next working session

These are the most useful next engineering tasks:

1. Run and validate the frontend local deployment flow.
2. Run and validate the backend webhook flow with real credentials.
3. Rewrite `frontend/README.md` to match whichever product direction is chosen.
4. Fix the broken `RTK.md` reference in repo instructions.
5. Remove or clearly mark inactive/future deployment paths.

## 8. Bottom line

The repo is **not empty** and **not blocked on missing core implementation**.

The real issue is this:
- there is already substantial code in place,
- but the repo still tells two different product stories,
- and the docs overstate or misstate parts of the implementation.

The next win is not adding more features blindly.
The next win is choosing the primary product, validating the real flow end to end, and deleting ambiguity.
