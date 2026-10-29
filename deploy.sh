#!/usr/bin/env bash
set -euo pipefail

# Yell AI — Firebase Hosting + Cloud Run (Mumbai asia-south1) Deploy Script
# Domain Management: Netlify DNS (yell.nhancio.com, api.yell.nhancio.com)
# Deployment: Firebase Project yell-ai-nhancio (nithindidigam@nhancio.com)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PROJECT="${FIREBASE_PROJECT:-yell-ai-nhancio}"
ACCOUNT="${FIREBASE_ACCOUNT:-nithindidigam@nhancio.com}"
REGION="${CLOUD_RUN_REGION:-asia-south1}"

echo "==> 1/3 Deploying FastAPI Backend (yell-ai-api) to Cloud Run ($REGION)..."
python3 -c '
import subprocess, pathlib
env_path = pathlib.Path(".env")
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        if k in ("WHATSAPP_PROVIDER", "KAPSO_API_KEY", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TOKEN", "WHATSAPP_VERIFY_TOKEN", "GEMINI_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "COMPOSIO_API_KEY"):
            env_vars[k] = v

env_vars["DATABASE_URL"] = "sqlite+aiosqlite:////tmp/yellai.db"
env_vars["APP_URL"] = "https://yell.nhancio.com"
env_vars["FRONTEND_URL"] = "https://yell.nhancio.com"
env_vars["ADS_ENABLED"] = "true"

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

echo "==> 3/3 Deploying Frontend + Rewrites to Firebase Hosting ($PROJECT)..."
firebase deploy --only hosting --project "$PROJECT"
netlify deploy --prod --no-build --dir=frontend/out --site="7128a350-9f2e-45ca-9bca-d1f304a4fbc3"      # yell.nhancio.com (landing)
netlify deploy --prod --no-build --dir=frontend/out-app --site="45cced1b-8105-4021-a5f2-00d35fc92004"  # yellapp.nhancio.com (app)

echo "✅ Deployment complete!"
echo "   Firebase URL: https://yell-ai-nhancio.web.app"
echo "   Custom URL:   https://yell.nhancio.com"
echo "   API URL:      https://api.yell.nhancio.com"
echo "   App URL:      https://yellapp.nhancio.com"
