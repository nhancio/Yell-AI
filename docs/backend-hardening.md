# Backend hardening — 30 October 2026

This change strengthens backend infrastructure and trust boundaries. It adds no agent use cases and has not been deployed.

## Local services

The configured backend now uses an isolated PostgreSQL 16 database at `127.0.0.1:55432` and authenticated Redis at `127.0.0.1:6380`.

- PostgreSQL uses SCRAM-SHA-256 authentication. The `yell_backend` application role is not a superuser and cannot create roles or databases.
- Redis binds only to loopback, requires a random password, and persists data with AOF.
- Private connection details live in ignored `.env` files with mode `0600`. Database files and the Redis configuration are in ignored `.runtime/` directories. PostgreSQL administrator credentials are in `.runtime/postgres-admin.env`, also mode `0600`.
- The existing SSH tunnel on port 5433 and its server/database were not changed. No existing database volumes were reset or migrated.
- `BACKEND_DATABASE_URL` now overrides `DATABASE_URL`. This prevents the backend from accidentally using a frontend SQLite URL or the old development connection.

Start the backend using the installed project environment:

```sh
cd backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The native dependency services currently run in the background. If stopped or after reboot, restart them from the repository root:

```sh
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D "$PWD/.runtime/postgres" -l "$PWD/.runtime/postgres.log" start
redis-server "$PWD/.runtime/redis/redis.conf"
```

To stop only these task-owned services, stop PostgreSQL with the same data directory and Redis with its recorded PID after checking it still belongs to that Redis instance. Do not reset `.runtime/` if you want to keep this local database.

## Request authentication

| Routes | Required identity |
| --- | --- |
| `/api/me/*`, legacy connector status/link/confirm | Firebase bearer token with a verified phone |
| `/payment/create-link`, `/payment/status/{phone}` | Firebase bearer token; requested phone must match the verified owner |
| `/admin/*`, `/stats`, campaign list/create/toggle and campaign analytics | `X-Admin-Key` with a configured random key of at least 32 characters |
| `POST /webhook` | Valid Meta HMAC-SHA256 signature over the exact body bytes |
| `GET /webhook` | Matching private subscription verification token |
| `POST /payment/webhook` | Valid Razorpay webhook signature |
| `/health`, `/ready`, connector catalog, payment return page, click redirects | Public |

Admin keys are for trusted administrative clients and must never be embedded in frontend bundles. The old hard-coded key and short/blank keys are rejected. Legacy anonymous checkout and campaign management calls must now supply the corresponding identity; the existing authenticated app is the user entry point.

Ad-wallet prepayment and client-side payment confirmation return `503` even to an administrator. The old wallet implementation trusted client-submitted amounts and did not prevent receipt replay. This task disables that funding path; implementing a new settlement workflow is intentionally outside scope. Subscription payment APIs remain protected by user authentication and provider signatures.

## WhatsApp setup still required

The real `WHATSAPP_APP_SECRET` was missing from the inspected local and Cloud Run configuration. The user elected to set it locally in `backend/.env` using Meta App settings → Basic. No replacement secret was invented. Until the real value is present, incoming POST requests are rejected.

The subscription verification token was changed locally from the public default to a random private value. When configuring or deploying the webhook, use the corresponding private value in Meta as well. Restart the backend after changing environment files because settings are cached per process.

Verification now rejects unsigned, incorrectly prefixed, malformed, or modified requests; signed invalid JSON receives `400` and payloads over 1 MiB receive `413`. No messages were sent during verification.

## Readiness and failure behavior

- `/health` is a liveness check.
- `/ready` performs bounded PostgreSQL and Redis checks, returning `200` when both work and `503` when either is unavailable. It does not expose connection URLs, credentials, or exception details. Integration credentials and provider approval remain separate setup requirements.
- Database initialization failures stop application startup instead of being swallowed.
- Redis connection and operation timeouts are bounded. The default Redis URL is no longer incorrectly treated as “disabled.” Failed clients are closed.
- Process-local conversation fallback is development-only. `ENVIRONMENT=production` disables it regardless of the fallback flag and refuses ephemeral SQLite storage.
- CORS defaults to configured frontend origins and development localhost origins. It permits bearer/admin headers without enabling cross-origin cookies.

## Container and deployment configuration

Compose uses service hostnames for API-to-database connections, waits for dependency health checks, binds published ports to loopback, and maps the API to its actual container port 8080. Docker-only `POSTGRES_PASSWORD` and `REDIS_PASSWORD` must be set to long URL-safe random values. Native dependencies and Compose alternatives should not occupy the same published ports simultaneously.

For an existing PostgreSQL Docker volume, credentials must match its initialized database. Changing `POSTGRES_PASSWORD` in Compose does not rotate the password stored in an existing volume; do not delete a volume to resolve a credential mismatch.

`run.sh` waits for Compose health checks, constructs host connection URLs from the configured credentials, and refuses to kill unrelated port listeners.

`deploy.sh` requires a Python environment containing backend dependencies. Its preflight rejects local service URLs, missing required secrets, weak admin keys and ephemeral databases. It uses a temporary private environment file rather than placing secret values in command arguments. It no longer overwrites the backend database with `/tmp` SQLite. Hosted PostgreSQL and Redis must be configured separately before any deployment; local services are not reachable from Cloud Run.

## Validation

The regression suite passed 48 tests with isolated SQLite and mocked external providers. Live local checks separately confirmed PostgreSQL connectivity and schema startup, Redis authentication, shared memory between separate service instances, dependency readiness, protected HTTP routes, and CORS rejection for an untrusted origin.

Run the suite from `backend/`:

```sh
BACKEND_DATABASE_URL=sqlite+aiosqlite:///:memory: DATABASE_URL=sqlite+aiosqlite:///:memory: .venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m compileall -q app tests
```

Shell syntax and whitespace checks passed. Compose YAML was parsed and inspected; the Docker runtime was unavailable on this machine, so a container boot was not verified. Cloud Run configuration was inspected read-only. No deployment, real payment, live message, or CRM write was performed.
