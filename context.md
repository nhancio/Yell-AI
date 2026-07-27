# Yell AI — Context

## Product Purpose

Yell AI is a WhatsApp-first AI assistant. The repo currently holds **two
related but different product tracks** (per `READINESS.md`, last updated
2026-04-09):

- **Hosted WhatsApp bot** (`backend/`): users message a WhatsApp number,
  the backend classifies emotion/intent and replies via Gemini, tracks
  usage, and upsells premium via Razorpay.
- **Local NanoClaw launcher** (`frontend/`): a signed-in user clicks
  "Deploy Now", the app spins up a local, Docker-isolated NanoClaw runtime
  under `frontend/.runtime/nanoclaw/<deployment-id>`, starts WhatsApp QR
  auth, and the user chats with a Claude-powered assistant once scanned.

These are not yet unified into one product story — see "Known Blockers"
below.

## Stack

- **Backend** (`backend/`): Python 3.12, FastAPI, `uvicorn`, SQLAlchemy,
  Redis (usage/memory), PostgreSQL, Google Gemini, Razorpay payment links.
  Deployed via Docker (`backend/Dockerfile`) or Vercel (`backend/vercel.json`,
  `@vercel/python`).
- **Frontend** (`frontend/`): Next.js 14, NextAuth (Google OAuth), Prisma
  (SQLite by default via `DATABASE_URL=file:./dev.db`), Tailwind, `qrcode`
  for the WhatsApp QR flow, `@aws-sdk/client-ec2` (unused EC2 deploy path,
  see below).
- **Runtime** (`nanoclaw/`): vendored fork of `qwibitai/nanoclaw` — "an AI
  assistant that runs agents securely in their own containers." Already
  includes a WhatsApp channel (`nanoclaw/src/channels/whatsapp.ts`). Has its
  own `upstream` (`qwibitai/nanoclaw`) and `whatsapp`
  (`qwibitai/nanoclaw-whatsapp`) git remotes in addition to
  `didigamnithin/nanoclaw` origin.
- **Local infra**: `docker-compose.yml` runs Redis on host port **6380**
  (container 6379) and Postgres on host port **5433** (container 5432),
  deliberately offset from Homebrew's default 6379/5432.

## Folder Structure

```
Yell AI/
├── backend/            FastAPI WhatsApp bot (app/main.py, routes/, services/, agents/)
├── frontend/            Next.js NanoClaw launcher (src/app, src/components, src/lib, prisma/)
├── nanoclaw/             Vendored NanoClaw runtime fork (own git repo + remotes)
├── docker-compose.yml    Local Redis + Postgres
├── run.sh / stop.sh / deploy.sh / git.sh
├── READINESS.md          Detailed product-direction audit/backlog
├── DEPLOYMENT.md         Target prod architecture (Vercel + DNS + runtime VM)
└── docs (DEPLOYMENT.md, READINESS.md, AWS_GUIDE.md under frontend/, etc.)
```

## Current Status

Per `READINESS.md`:

- Backend: webhook verification, WhatsApp send/mark-read, Kapso + Meta
  provider support, Gemini integration, emotion/intent/task orchestration,
  Redis-backed memory, usage enforcement, Razorpay payment links, admin
  stats — all implemented but **not yet verified end-to-end with real
  credentials**.
- Frontend: Google OAuth, Prisma schema, dashboard, deployment list/QR/log
  endpoints, local NanoClaw runtime bootstrap, WhatsApp auth, self-chat
  registration, bot process startup — all implemented but **not yet
  verified end-to-end**.
- An EC2-based deploy path exists under `frontend/src/lib/deploy/` but is
  **not wired up** to the active dashboard flow (only the local Docker
  path is active).

## Known Blockers

- **Product direction undecided**: hosted WhatsApp bot (`backend/`) vs.
  local/self-host NanoClaw launcher (`frontend/`) — see `READINESS.md`
  section 4 for the tradeoffs. Docs and Prisma fields currently imply a
  broader hosted-deployment plan than the active `/api/deploy` route
  supports.
- **Nested git repos**: the project root, `frontend/`, and `nanoclaw/` each
  have their **own separate `.git` directory**. The root repo currently has
  no `origin` remote configured. `git.sh` at the root only operates on the
  root repo — changes inside `frontend/` or `nanoclaw/` need to be
  committed in those nested repos separately (or the nested `.git` folders
  removed/gitignored if they're meant to be tracked as plain files in the
  root repo).
- **Stale docs**: older notes reference `myclaw/` and EC2-first assumptions
  that don't match the current local-Docker-first flow; an `AGENTS.md` →
  `RTK.md` reference mentioned in `READINESS.md` does not currently resolve
  (`AGENTS.md` was not found at the repo root).
- Frontend dashboard currently only collects `assistantName`; it does not
  collect AI provider, API key, or WhatsApp Business credentials despite
  Prisma fields suggesting that was planned.

## Key Integrations

- **Kapso** / **Meta** — WhatsApp Business messaging providers
- **Google Gemini** — reply generation, emotion/intent classification
- **Razorpay** — payment links for premium upgrade
- **Google OAuth (NextAuth)** — frontend sign-in
- **Redis** — usage/memory store (backend)
- **PostgreSQL** — backend persistence; **Prisma/SQLite** — frontend
  deployment records
- **NanoClaw** (Anthropic Claude-based agent runtime, Dockerized)

## Next Steps

See `next steps.md` for the current task checklist, and `READINESS.md` for
the full prioritized backlog (P0/P1/P2).
