# Production account storage

Status: persistent storage was activated on Cloud Run revision `yell-ai-api-00026-piz`. Subsequent releases retain the same managed database and record their source commit in the Cloud Run `git-sha` label. Firebase Hosting at `https://tryastra.web.app` is also updated.

## Database configuration

| Setting | Value |
| --- | --- |
| Project | `yell-ai-nhancio` |
| Cloud SQL instance | `astra-postgres` |
| Connection | `yell-ai-nhancio:asia-south1:astra-postgres` |
| Region / engine | Mumbai / PostgreSQL 16 |
| Database / application user | `astra` / `astra_app` |
| Capacity | `db-f1-micro`, 10 GB SSD, automatic growth capped at 20 GB |
| Recovery | Daily backups at 20:30 UTC, seven retained backups, seven-day point-in-time recovery |
| Network | Encrypted, Cloud SQL connector required; no public authorized-network rules |
| Deletion protection | Enabled |
| Connection URL | Secret Manager `astra-database-url`, version 1 |

Cloud Run mounts the Cloud SQL Unix socket and reads both `DATABASE_URL` and `BACKEND_DATABASE_URL` from the secret. Credentials are not stored in the repository. Application instances are capped at three; each has a pool of two database connections plus three overflow connections.

Cloud SQL is a separately billed Google Cloud resource. This small configuration is a single-zone instance, with backups rather than automatic regional failover. [Google pricing](https://cloud.google.com/sql/pricing).

## What is persistent

The database stores verified WhatsApp access bindings, account profiles, onboarding, subscriptions, daily usage, connector records and tool-run records. Sharing the agent number does not grant an account or subscription.

The user approved activating the existing temporary-database release first, accepting its reset risk. Historical SQLite rows cannot be exported through the existing live API. The cutover restores access bindings from enabled Firebase accounts that have the phone provider, which is trusted evidence of a previous phone login. It does not infer authentication from old usage/profile rows.

Conversation memory is a separate service. Shared Redis is still unavailable; its existing development fallback is local to each container. This database cutover does not claim that chat memory is durable or that all dependency-readiness checks are green.

## Validation and future releases

`backend/scripts/verify_persistent_storage.py` is executed as the manual Cloud Run job `astra-storage-verify`. Prepare restores the verified bindings and writes a marker; a separate verify execution reads it after the backend cutover. It logs counts only and suppresses private error details. No WhatsApp messages, verification SMS or payments are sent by this check.

The prepare execution `astra-storage-verify-8xcfz` restored two verified phone bindings. The fresh execution `astra-storage-verify-x94gl` completed successfully after the backend cutover, confirming the storage marker survived. Live checks show the database is reachable, unauthenticated session creation returns 401, and the landing page has 21 account-entry links with zero direct WhatsApp links. The service's two database environment variables are Secret Manager references, and the Cloud SQL attachment and instance cap were verified from the deployed configuration.

The initial on-demand backup `1793387581656` completed successfully at `2026-10-30T19:14:32Z`. The initial automated backup is also successful. Temporary local database credential files were removed after deployment; the deployed credential remains in Secret Manager.

The release script now preserves the managed database configuration instead of forcing SQLite. Production configuration rejects non-PostgreSQL URLs. When rolling back application code, retain the Cloud SQL attachment and database secret references; do not restore a temporary SQLite environment.

The final backend suite passes all 74 tests. Production database validation and administrator authorization for campaign GET/POST routes pass. Three static-export checks and the production frontend build also pass.
