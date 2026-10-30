# Backend verification — 30 October 2026

Follow-up: local dependency configuration and backend security have since been strengthened. See [the hardening report](../backend-hardening.md) for current local results and remaining provider setup. The observations below describe the earlier configuration.

Scope: verify the current backend. No new agent use cases, CRM account connections, or external writes were performed during this verification pass.

## Result

The application runs against an isolated SQLite database, but its currently configured PostgreSQL and Redis connections are not working. Passing isolated tests does not establish production readiness.

| Check | Result |
| --- | --- |
| Backend test suite | 27 tests passed using isolated SQLite and mocked provider execution |
| Existing connector-confirm regression script | Passed: raw execution endpoint absent; confirmation trusts provider status |
| Dependency compatibility | 49 installed packages compatible, including the PostgreSQL driver |
| Python compilation and application import | Passed |
| OpenAPI generation | Passed; 30 paths |
| Uvicorn startup with isolated SQLite | Passed; users, connections, and tool-run tables created |
| HTTP `/health` and `/openapi.json` | 200 |
| Unauthenticated connection and tool-run requests | 401 |
| Removed `/api/connectors/execute` endpoint | 404 |
| Configured PostgreSQL, read-only `SELECT 1` probe | Failed: `InvalidPasswordError` |
| Configured Redis, `PING` probe | Failed: `ConnectionError` |
| Live Composio metadata reads | API key accepted; eight existing auth configurations found; Gmail and HubSpot tool metadata resolved |

The tests cover phone ownership, invalid/missing sessions, OAuth callbacks, revoked accounts, provider outages, disconnect ownership, tool/app matching, pinned versions, duplicate requests, concurrent approvals, cancellation, and ambiguous execution outcomes. They do not execute real email or CRM actions.

## Findings requiring attention

1. **Database credentials fail.** The configured PostgreSQL server rejects authentication. Correct the environment credentials before relying on user records or durable tool runs. Startup and `ensure_tables()` currently tolerate database errors, which can hide this failure.
2. **Redis is unreachable.** The configured connection fails. Conversation memory falls back to a process-local dictionary, which does not survive restarts or work consistently across workers. Additionally, `MemoryService._get_redis()` skips connecting whenever the URL equals `DEFAULT_REDIS_URL`.
3. **WhatsApp webhook requests are not authenticated.** `POST /webhook` parses and schedules incoming messages without verifying a provider signature. GET subscription verification does not authenticate incoming POST requests. This is a source-review finding; no forged live message was submitted.
4. **Health reporting does not check dependencies.** `/health` returns a constant healthy response, including when PostgreSQL or Redis is unavailable. It is a liveness check, not a readiness check.
5. **Some older APIs still lack ownership controls.** `/stats` and brand campaign mutation routes do not require authentication. The brand wallet verification code also trusts the submitted amount and does not record consumed payment IDs, so a valid signed payment could be replayed. These are source-review findings; no real payment was generated or replayed.

No CRM was configured or connected, following the user's choice of “none.” Live Firebase login, user OAuth consent, real tool execution, payment settlement, and delivery of messages were not verified.

## Reproduction

From `backend/`, use Python 3.12 and install `requirements.txt` in an isolated environment:

```sh
DATABASE_URL=sqlite+aiosqlite:///:memory: python -m unittest discover -s tests -v
DATABASE_URL=sqlite+aiosqlite:////tmp/yell-connector-check.db python -m tests.test_connector_confirm
python -m compileall -q app tests
```

For a separate startup smoke test, override `DATABASE_URL` to a disposable SQLite file, use an unused local port, and avoid calling messaging/payment endpoints. The verification server used port 18765 and was stopped afterward.

`git diff --check` also reported whitespace issues in the current working tree. These were recorded without modifying unrelated concurrent edits. No deployment was performed.
