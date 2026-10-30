#!/usr/bin/env bash
set -euo pipefail

# Astra AI — Firebase Hosting + Cloud Run (Mumbai asia-south1) Deploy Script
# Domain Management: Netlify DNS (astra.nhancio.com, api.astra.nhancio.com)
# Deployment: Firebase Project yell-ai-nhancio (nithindidigam@nhancio.com)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PROJECT="${FIREBASE_PROJECT:-yell-ai-nhancio}"
ACCOUNT="${FIREBASE_ACCOUNT:-nithindidigam@nhancio.com}"
REGION="${CLOUD_RUN_REGION:-asia-south1}"

echo "==> 1/3 Deploying FastAPI Backend (yell-ai-api) to Cloud Run ($REGION)..."
python3 -c '
import subprocess, pathlib

env_vars = {}
for line in open(".env"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    k, v = k.strip(), v.strip()
    if k in ("WHATSAPP_PROVIDER", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TOKEN", "WHATSAPP_VERIFY_TOKEN", "GEMINI_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "COMPOSIO_API_KEY"):
        env_vars[k] = v

env_vars["DATABASE_URL"] = "sqlite+aiosqlite:////tmp/yellai.db"
env_vars["APP_URL"] = "https://astra.nhancio.com"
env_vars["FRONTEND_URL"] = "https://astra.nhancio.com"
env_vars["ADS_ENABLED"] = "true"
env_vars["MONTHLY_PRICE_PAISE"] = "9900"
env_vars["BUSINESS_PRICE_PAISE"] = "99900"

env_arg = ",".join(f"{k}={v}" for k, v in env_vars.items())

subprocess.run([
    "gcloud", "run", "deploy", "yell-ai-api",
    "--source", "backend",
    "--region", "'"$REGION"'",
    "--allow-unauthenticated",
    "--project", "'"$PROJECT"'",
    "--account", "'"$ACCOUNT"'",
    "--set-env-vars", env_arg,
    "--quiet"
], check=True)
'

echo "==> 2/3 Building Next.js Static Export (frontend/out)..."
(cd frontend && npm run build:sites)

echo "==> 3/3 Deploying Multi-Site Hosting to Firebase ($PROJECT)..."
firebase deploy --only hosting --project "$PROJECT"

echo "✅ Deployment complete 100% on Firebase & Cloud Run!"
echo "   Landing (Firebase): https://astra-ai-nhancio.web.app"
echo "   App Hub (Firebase): https://astraapp-nhancio.web.app"
echo "   Cloud Run API:      https://yell-ai-api-6epx3aakpq-el.a.run.app"
