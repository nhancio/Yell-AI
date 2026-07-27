# Next Steps - Yell AI

- [ ] Decide the primary product direction: hosted WhatsApp bot (`backend/`) vs. local NanoClaw launcher (`frontend/`) — see `READINESS.md` section 4
- [ ] Verify the frontend local NanoClaw flow end to end (sign in → deploy → QR → scan → bot ready → reply)
- [ ] Verify the backend WhatsApp webhook flow end to end with real Kapso/Meta credentials
- [ ] Resolve the nested-git-repo setup (root has no `origin`; `frontend/` and `nanoclaw/` each carry their own `.git`) before relying on `git.sh`
- [ ] Rewrite `frontend/README.md` and fix the broken `AGENTS.md` → `RTK.md` reference once the product direction is chosen
- [ ] Replace default `ADMIN_API_KEY` and lock down `CORS_ALLOWED_ORIGINS` before any production deploy
