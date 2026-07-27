# Yell AI Deployment Plan

## 1. Target architecture

Use three surfaces:

### Frontend
- Domain: `yell.nhancio.com`
- Host: Vercel
- App: `frontend/`

### Backend API
- Domain: `api.yell.nhancio.com`
- Host: Vercel or another HTTPS host
- App: `backend/`

### Runtime worker
- Domain: optional public subdomain later, or private host only
- Host: EC2 / VPS / any persistent Docker-capable Linux machine
- Purpose: run NanoClaw instances, WhatsApp QR auth, and persistent bot processes

## 2. Important limitation

The current `Deploy Now -> QR -> persistent bot` flow cannot run fully inside Vercel.

Reason:
- Vercel functions are serverless
- the current runtime flow needs Docker
- it writes files under `.runtime`
- it spawns long-running child processes
- it keeps a WhatsApp auth process and bot process alive

Because of that:
- the frontend can be deployed to Vercel
- the backend can be deployed to Vercel
- the NanoClaw runtime must run on a persistent server

## 3. Frontend deployment

### Project root
- `frontend/`

### Required environment variables
- `DATABASE_URL`
- `NEXTAUTH_URL=https://yell.nhancio.com`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Optional server defaults
- `YELLAI_ANTHROPIC_API_KEY`
- `YELLAI_CLAUDE_CODE_OAUTH_TOKEN`
- `NEXT_PUBLIC_RUNTIME_ENABLED=false` until a persistent runtime worker is connected

### Current production behavior

When deployed on Vercel, `POST /api/deploy` intentionally returns `503` until a persistent runtime worker is wired in.

This prevents the UI from pretending that NanoClaw deployments can run inside a Vercel function.

## 4. Backend deployment

### Project root
- `backend/`

### Suggested domain
- `api.yell.nhancio.com`

### Required environment variables
- `WHATSAPP_PROVIDER`
- `KAPSO_API_KEY` or `WHATSAPP_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `GEMINI_API_KEY`
- `REDIS_URL`
- `DATABASE_URL`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `ADMIN_API_KEY`
- `CORS_ALLOWED_ORIGINS=https://yell.nhancio.com`
- `APP_URL=https://api.yell.nhancio.com`

### Notes
- `backend/vercel.json` already exists
- Redis and Postgres must be hosted externally for Vercel

## 5. DNS records needed

These are the records to add in your DNS provider once the Vercel projects exist.

### Frontend
- `yell.nhancio.com` -> Vercel project alias

### Backend
- `api.yell.nhancio.com` -> Vercel project alias

If you prefer manual records:
- add the standard Vercel CNAME or A records shown by the Vercel domain setup screen

## 6. What is still needed from you

### Access / platform
- permission to use your Vercel account and projects
- DNS control for `nhancio.com`, or you add the DNS records I specify

### Frontend secrets
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Backend secrets
- `KAPSO_API_KEY` or Meta WhatsApp token
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `GEMINI_API_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `ADMIN_API_KEY`
- hosted `REDIS_URL`
- hosted backend `DATABASE_URL`

### Runtime host
- one server with Docker
- SSH access or deployment access

## 7. Practical rollout order

1. Deploy frontend to Vercel
2. Bind `yell.nhancio.com`
3. Deploy backend to Vercel
4. Bind `api.yell.nhancio.com`
5. Provision one Docker-capable runtime VM
6. Rewire `POST /api/deploy` to forward jobs to that runtime host
7. Re-enable the live `Deploy Now -> QR -> Chat` flow
