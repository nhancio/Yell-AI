# Yell AI — Run the deploy to QR to chat flow

## 1. Install and set env

```bash
cd /Users/nithi/Desktop/Claude-Projects/Nhancio-projects/Yell AI/frontend
npm install
npx prisma generate
npx prisma db push
```

## 2. Configure frontend auth

Set these in `frontend/.env`:

- `DATABASE_URL`
- `NEXTAUTH_URL=http://localhost:3000`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 3. Configure Claude auth

Use either:

- a server default in `frontend/.env` or repo root `.env`
- or paste the credential directly into the deploy form

Supported defaults:

- `YELLAI_ANTHROPIC_API_KEY`
- `YELLAI_CLAUDE_CODE_OAUTH_TOKEN`
- `ANTHROPIC_API_KEY`
- `CLAUDE_CODE_OAUTH_TOKEN`

## 4. Make sure Docker is running

The runtime flow depends on Docker being available to the Next.js app process.

## 5. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## 6. Test the real product flow

1. Sign in with Google
2. Click `Deploy Now`
3. Enter assistant name
4. Optionally paste Claude credential
5. Submit deployment
6. Wait for the QR code in the deployment card
7. Scan it with WhatsApp
8. Send `@AssistantName` in your self-chat
9. Confirm the assistant replies
