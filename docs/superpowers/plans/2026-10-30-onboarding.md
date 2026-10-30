# Poke-style onboarding

Build the user-approved onboarding flow around the existing Firebase phone login. Reuse existing Composio connections and Razorpay checkout. Keep the current brand and configured monthly prices.

- [x] Add an authenticated onboarding state API and a new table for interests, current step, and completion. Save the user's name in the existing profile. Test ownership, persistence, validation, resume, and plan selection using isolated SQLite and mocked external providers.
- [x] Add reusable dark onboarding screens: name, interests, optional app connections, a ready screen with a chat link, and optional plan selection. Phone and OTP precede these steps. Include skip/back actions, keyboard-accessible controls, mobile layouts, loading/error states, and OAuth resume.
- [x] Integrate onboarding into the existing app entry point. Completed users reach their dashboard; users can reopen setup. Add a development-only visual preview without bypassing production authentication or calling providers.
- [x] Run backend regressions, build both static sites, and verify the preview on desktop and mobile. Capture reviewable screenshots. Do not deploy or send SMS, messages, or payments during testing.

Interests are saved preferences. This task does not implement the selected agent use cases or invent annual billing, premium models, or background automation capabilities.

Verification (2026-10-30): all 57 backend tests pass, including 9 onboarding/plan tests. Both static sites compile with TypeScript and lint checks. Browser checks cover the full preview flow at desktop width, 390px mobile and 320px mobile; keyboard plan selection, skipping payment, and phone validation work. The production export shows phone login at the app entry and a 404 at the development preview route. Isolated PostgreSQL verifies JSON preferences and timezone timestamps with test records rolled back. Screenshots are saved under `.runtime/onboarding-*.jpg`.

No live SMS, OAuth grant, payment, or deployment was performed. OAuth return resumes the saved apps step and reads provider connection status; live authorization and payment completion still require the configured external services.
