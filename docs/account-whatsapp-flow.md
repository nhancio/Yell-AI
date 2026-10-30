# Account and WhatsApp entry flow

## Audit

Before activation, the live landing page at `https://tryastra.web.app` exposed 15 direct WhatsApp links, plus a direct-chat QR code. Consumer journeys split into account login, direct chat, and direct checkout. The Brands portal is a separate business journey.

The activated website routes 21 account-related landing links through `/app`, with zero direct WhatsApp links on the public landing page. The QR code also opens `/app` on the current site. Product descriptions, FAQs, Brands, and other informational navigation remain public.

## Updated consumer journey

```mermaid
flowchart TD
    A[Landing: Get Started, login, recipe, QR or plan] --> B[/app: WhatsApp number + SMS OTP]
    B --> C[Backend verifies Firebase token and binds its phone]
    C --> D[Account and optional personalization]
    D --> E[Chat now on WhatsApp]
    D --> F[Optional authenticated checkout]
    G[Someone texts the agent directly] --> H{Verified phone binding exists?}
    H -->|Yes| I[Commands, usage checks and agent]
    H -->|No| J[Login instructions only]
    J --> B
```

Login and account creation use the same OTP flow. Returning users with a Firebase session skip OTP. Once the backend has accepted that verified login, Chat now is available throughout optional personalization; no purchase or app connection is required to begin chatting. Recipes and selected plans survive login and app-connection returns. OAuth callbacks and the old `/connect` route lead to `/app`; old home-page `connected` and `#login` links are also redirected.

## Access boundary

- `POST /api/me/session` requires a valid Firebase token with a verified phone claim. The binding phone comes exclusively from that claim, never request body or URL input.
- The new `verified_whatsapp_accounts` table records successful website phone login. Existing users, usage counts, payments, names, and onboarding preferences do not substitute for this proof. Existing schema initialization creates this new table without altering existing user columns.
- Every incoming WhatsApp processing path checks the binding first, including greetings, connections, clear-history, upgrades and ordinary AI requests. Unregistered senders get a login link only. A database failure denies access without disclosing the error or invoking the agent.
- This is a one-time verified number binding. Logging out of the browser does not disconnect the already verified WhatsApp channel. WhatsApp messages are checked by their Meta-signed sender identity, not a browser session or a secret chat link.
- Contact links are rendered from authenticated account data. Knowing the WhatsApp number alone does not grant agent access.
- Checkout notes now store the same canonical phone format as account records. Premium activation also accepts old payment notes containing a leading `+`, avoiding successful payments that fail to find their account.
- Paid usage allowances require an active premium entitlement. Expired subscriptions reset to Free; stale Pro/Business labels on unpaid accounts cannot grant a paid allowance. The current product still intentionally offers a Free allowance after login.

## Validation and rollout

- Five backend regression tests pass, including invalid/missing tokens, legacy usage profiles, every command before login, repeat registration, cross-phone isolation and storage failure.
- Three checks against the actual static export pass: no public direct agent contact, consistent account entry, and both paid plans beginning at login.
- Two payment identity regression tests pass for canonical checkout notes and activation from legacy phone formats, using mocked Razorpay calls and an isolated database.
- Three usage-entitlement tests cover unpaid stale plan labels, subscription expiry across repeated requests, and valid active paid access.
- The Next.js production build passes, including type checks. Browser checks confirm Get Started reaches the OTP screen and offers no direct WhatsApp link before login. No real OTP, WhatsApp message, payment or new live user account was created during validation.
- Final release validation passes all 74 backend tests and all three static-export checks. Anonymous brand-campaign GET/POST routes now require the existing administrator authorization, and Brands/Ads pages route agent entry through `/app`. The public campaign portal explains that campaign management requires authorized access and disables anonymous campaign creation.
- With the user's approval of the temporary-data reset risk, backend revision `yell-ai-api-00024-giw` was activated and the Firebase Hosting site was released. PostgreSQL-backed revision `yell-ai-api-00026-piz` subsequently took 100% of live traffic. Two verified phone bindings were restored from Firebase; a fresh container execution confirmed a database marker persisted across deployment. Live checks confirm login is required by account endpoints, signed webhooks are accepted, and unsigned webhooks are rejected. See [production storage](production-storage.md) for configuration and remaining memory-service limits.

Checks:

```sh
cd backend
.venv/bin/python -m unittest discover -s tests -p test_whatsapp_access.py
cd ../frontend
npm run build
python3 -m unittest discover -s tests
```
