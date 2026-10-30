# Astra Meta / WhatsApp setup — 30 October 2026

## Confirmed configuration

- Meta app `1936770397297317` renamed from `yellAI` to `Astra`.
- App category: Utility and productivity.
- Phone: `+91 87909 68218`; phone ID: `1483205761535533`.
- Cloud API WABA: `1947377422837104`. The original test WABA is `2894784247561814`, with test phone ID `1420290087828561`.
- Registration succeeded using the interactive administrator's temporary token. Subsequent API reads report `CONNECTED`, `CLOUD_API`, `VERIFIED`, and account mode `LIVE`.
- The permanent system-user token also needs access to paid messaging account `1439682280889649`. Without that assignment, inbound events arrive but outgoing requests fail with `(#10) Viewer cannot access the provided Paid Message Account`. The system user has now been assigned MANAGE on that account and access was verified.
- Astra's app is subscribed to production WABA events. The existing Kapso subscription was retained.
- Callback: `https://yell-ai-api-6epx3aakpq-el.a.run.app/webhook`; existing subscribed fields preserved, including `messages`.
- Cloud Run environment now contains the correct phone ID/display number, real app secret, and a private webhook verification token. Existing permanent access token retained.
- Secrets and registration PIN are stored only in ignored env files; the temporary setup token was removed after use. No secret values belong in this document.
- App logo: approved emerald-to-lime four-point star. Meta rejected the white-background app icon, so a transparent 1024px derivative is used. The original white-background version is used for the WhatsApp profile.
- Privacy: `https://tryastra.web.app/privacy`.
- Data deletion: `https://tryastra.web.app/data-deletion`.
- WhatsApp display-name change from Chitti to Astra was submitted and is in review.

## Verification

- Public privacy and deletion pages return HTTP 200 with expected content.
- Webhook GET returns the expected challenge with the private token.
- A correctly signed empty WhatsApp event returns HTTP 200 without sending a message.
- Meta accepted the callback subscription update with `success: true`.
- User confirmed the number became reachable from another WhatsApp number. Inbound webhook traffic was observed; first reply attempts revealed the paid-account permission error described above.
- After fixing that permission, an explicitly authorized test reply was accepted by Meta; the user confirmed receipt. Inbound and outbound transport are verified on the production number.
- Frontend production build passed; webhook-security tests passed (4 tests).
- Broader backend-hardening check: 16 of 17 tests passed. The existing `test_production_rejects_ephemeral_sqlite` fails because the production-settings validator currently returns without rejecting SQLite; this was not changed as part of the Meta setup.

## Remaining owner / Meta steps

- Production WhatsApp transport is working; no further registration or token replacement is needed for the verified flow.
- WhatsApp billing shows no payment method; Meta health reports error `141006`, which blocks business-initiated conversations. The correct WhatsApp billing account must be funded/configured by the owner.
- Business verification for NHANCIO TECHNOLOGIES PRIVATE LIMITED is pending submission. The app's Publish button is disabled until verification requirements are met; Tech Provider access verification is also listed on the publish checklist.
- Astra's WhatsApp display-name review is pending Meta's decision.
- Redis is unavailable in the hosted backend logs; this is a separate backend-readiness limitation, not a Cloud API registration issue.

## Deployment note

`deploy.sh` now merges allowlisted runtime values from root `.env` and `backend/.env`, matching backend settings precedence. Setup-only temporary credentials and the registration PIN are not forwarded to Cloud Run by the deployment script.
