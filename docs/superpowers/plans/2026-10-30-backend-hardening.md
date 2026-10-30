# Backend hardening implementation plan

**Goal:** Repair dependency configuration and enforce backend trust boundaries without adding agent use cases.

**Architecture:** Reuse Firebase phone identity for user operations and the existing admin-key dependency for administrative APIs. Verify raw webhook bytes before parsing. Make database failures visible and distinguish liveness from dependency readiness. Preserve external services, data, and the existing SSH tunnel.

**Stack:** FastAPI, SQLAlchemy async, Redis, unittest/httpx; no new runtime dependencies.

## Tasks

- [x] Add regression tests for default Redis connections, dependency outages, protected legacy APIs, strict webhook signatures and malformed payloads.
- [x] Fix backend database selection (`BACKEND_DATABASE_URL` precedence), stop swallowing initialization failures, enable connection health checks, and expose a dependency-aware readiness endpoint.
- [x] Connect to Redis even at the default URL; bound connection and operation timeouts, close failed clients, and make process-local fallback development-only.
- [x] Preserve existing HMAC verification; enforce signature format and body limits, reject malformed signed JSON, and protect webhook subscription verification from blank/default tokens.
- [x] Protect stats/campaign administration with the existing admin guard. Bind legacy payment-link/status operations to the authenticated phone. Disable the unsafe legacy wallet-credit endpoint rather than adding a billing use case in this task.
- [x] Align local/container configuration with their respective networks, add service health checks, and remove ephemeral database overrides from the deployment path. Do not deploy.
- [x] Verify real dependency connectivity where credentials permit, run the complete regression suite, test application startup/readiness, and document outstanding secret/provider requirements without exposing values.

## Validation commands

Run from `backend/` in an environment containing `requirements.txt`:

```sh
DATABASE_URL=sqlite+aiosqlite:///:memory: python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Use disposable databases for write tests. Live database diagnostics use `SELECT 1` only. Do not send messages, charge payments, rotate shared server passwords, or reset database volumes.
