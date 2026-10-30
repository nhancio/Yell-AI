# Astra AI

Astra AI is a WhatsApp-first AI assistant project with two related product
tracks living in one repo:

- **`backend/`** — a hosted FastAPI service that receives WhatsApp webhooks
  (Meta WhatsApp Cloud API), classifies emotion/intent, replies via Google Gemini,
  enforces usage limits, and creates Razorpay payment links for premium.
- **`frontend/`** — a Next.js 14 app ("Deploy Now") that lets a signed-in
  user spin up their own local **NanoClaw** runtime, scan a WhatsApp QR
  code, and chat with a Claude-powered assistant.
- **`nanoclaw/`** — a vendored fork (`qwibitai/nanoclaw`) that provides the
  actual containerized Claude-agent runtime and WhatsApp channel used by
  the frontend's deploy flow.

See `context.md` for the full architecture/status breakdown and
`READINESS.md` for the detailed product-direction backlog.

## Stack

- Backend: Python / FastAPI, SQLAlchemy, Redis, PostgreSQL, Gemini, Razorpay
- Frontend: Next.js 14, NextAuth (Google), Prisma, Tailwind
- Runtime: NanoClaw (Docker-isolated Claude agent containers)
- Infra: Docker Compose (local Redis/Postgres), Vercel (frontend + backend
  deploy targets)

## Usage

```bash
./run.sh            # starts Docker Redis/Postgres, backend (:8000), frontend (:3000)
./stop.sh            # stops everything ./run.sh started
./deploy.sh           # migrates the DB and deploys frontend + backend to Vercel
./git.sh "message"    # commit and push
```

`run.sh` will bootstrap a `.env` from `.env.example` on first run — fill in
real API keys before rerunning.

## More Info

- `context.md` — product purpose, stack, structure, status, blockers
- `next steps.md` — current task checklist
- `READINESS.md` — detailed audit of what's implemented vs. what's still
  undecided
- `DEPLOYMENT.md` — target production architecture and DNS/env plan
