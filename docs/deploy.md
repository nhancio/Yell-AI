# Deploy from main

Commit your edits, then run from the repository:

```sh
./deploy.sh
```

The script:

1. Fetches origin, switches to `main`, merges origin/main and every local branch.
2. Validates the merged commit: deployment workflow checks, backend tests, a clean frontend install, production build and frontend checks.
3. Deletes local branches only after their commits are merged into main and validation passes.
4. Pushes main. Other remote branches are deleted only when their exact tip is already merged into main; conditional deletion rejects concurrent remote changes. Remote-only unmerged work stops deployment and is retained.
5. Confirms that main is the only local and remote branch, at the same commit. Builds and deploys from a frozen copy of that commit, checks the staged backend, activates it, then publishes Firebase Hosting.

Dirty files, unfinished Git operations, conflicts, rejected pushes and failed checks stop the script. It never force-pushes main or force-deletes a local branch. Branches checked out in other worktrees must be released there first. Failed merges are aborted; source branches remain available.

The existing Cloud SQL, server environment, IAM and Secret Manager settings are retained. Local `.env` files are not uploaded or used to overwrite live configuration. Shared Redis is still a separate setup item. By default the smoke check allows only the known Redis-only 503 fallback, with an explicit warning, while PostgreSQL and access gates must pass. Set `REQUIRE_REDIS=1` to require HTTP 200 readiness with both dependencies healthy; any readiness failure then blocks promotion.

Required commands: Git, Python 3, npm, npx and gcloud, plus the installed backend virtual environment. HTTPS GitHub authentication uses the configured account's existing `gh` credential without changing the globally active account or writing the token to Git config. Other remote types use normal Git authentication.

Defaults:

| Variable | Default |
| --- | --- |
| `GITHUB_ACCOUNT` | `didigamnithin` |
| `FIREBASE_ACCOUNT` | `nithindidigam@nhancio.com` |
| `FIREBASE_PROJECT` | `yell-ai-nhancio` |
| `CLOUD_RUN_REGION` | `asia-south1` |
| `REQUIRE_REDIS` | `0` (allow and warn about the existing local-memory fallback) |
| `BACKEND_PYTHON` | `backend/.venv/bin/python` |

Run the workflow regression checks without touching GitHub or Google Cloud:

```sh
python3 -m unittest discover -s tests -p test_deploy_workflow.py
```
