# Astra AI Frontend

Astra AI is a managed deployment app for a WhatsApp-based NanoClaw assistant.

The intended user flow is:

1. User opens the landing page
2. User clicks `Deploy Now`
3. User enters the few inputs required for deployment
4. The app starts a NanoClaw runtime for that user
5. The app shows the WhatsApp QR code in the dashboard
6. The user scans the QR code
7. The assistant comes online and the user chats on WhatsApp

## What the current frontend does

- Next.js 14 app with Google sign-in
- Protected dashboard
- Creates a deployment record in Prisma
- Starts a local NanoClaw runtime under `frontend/.runtime/nanoclaw/<deployment-id>`
- Starts WhatsApp auth
- Exposes a QR endpoint for the dashboard UI
- Registers the user's self-chat as the main NanoClaw chat
- Starts the NanoClaw bot process
- Streams setup logs back into the deployment card

## Required inputs

The active deployment form supports:

- `Assistant name`
- `Claude credential`

The Claude credential can be either:

- an Anthropic API key, or
- a Claude OAuth token

If the user does not provide one, the server must already have a default credential configured.

## Local setup

```bash
cd frontend
npm install
cp ../.env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`.

## Environment notes

Minimum frontend auth requirements:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional default Claude credentials:

- `ASTRAAI_ANTHROPIC_API_KEY`
- `ASTRAAI_CLAUDE_CODE_OAUTH_TOKEN`
- `ANTHROPIC_API_KEY`
- `CLAUDE_CODE_OAUTH_TOKEN`

The active QR-based WhatsApp flow does **not** require the user to paste WhatsApp Business API credentials.

## Important implementation notes

- The active deploy path is `src/app/api/deploy/route.ts`
- The runtime bootstrap logic is `src/lib/nanoclaw/localDeployment.ts`
- The dashboard QR endpoint is `src/app/api/deployments/[id]/qr/route.ts`
- Deployment progress UI is in `src/components/DeploymentCard.tsx`

## Current product direction

This frontend should be treated as the main product surface:

- landing page
- deploy form
- QR onboarding
- live deployment status
- WhatsApp chat activation

Anything outside that flow should be considered secondary until this path is fully verified end to end.
