# Astra web app

Next.js 14 and React 18 static frontend for Astra's landing page, phone login,
optional onboarding, connected apps, subscriptions and WhatsApp entry.
Firebase Hosting serves the export; FastAPI owns account and database access.
The frontend does not use Prisma or connect directly to a database.

## Local development

Start the FastAPI backend on port 8000, then:

```sh
cd frontend
npm ci
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev
```

Open http://localhost:3000. Firebase client configuration is in
`src/lib/firebase-config.json`. Phone OTP login must be enabled for the app's
Firebase project. Backend secrets stay in server environment variables.

## Release checks

```sh
npm ci
npm run build
python3 -m unittest discover -s tests
```

The static export is written to `out/`. The root `firebase.json` routes
account, payment and webhook requests to the Cloud Run backend. Production
uses the same origin, so `NEXT_PUBLIC_BACKEND_URL` can be omitted.

Deploy from the repository root using `./deploy.sh`. The script preserves the
Cloud SQL attachment and Secret Manager database configuration. See
`../docs/production-storage.md` and `../docs/account-whatsapp-flow.md`.
