# WhatsApp reply latency

## Changes

- Send Meta's native text typing indicator, together with a read receipt, before database and agent work. Feedback has a two-second deadline; failure does not prevent processing the incoming message. Duplicate webhook deliveries do not repeat it.
- Use Gemini's asynchronous SDK call so one generation no longer blocks the server's event loop. Each generation has a 20-second deadline and SDK retries are disabled.
- Probe unavailable Redis once, with a one-second ping deadline, then wait 30 seconds before another connection attempt. Existing production behavior still requires shared memory; development fallback behavior is unchanged.
- Use Graph API v26.0, matching Meta's current typing-indicator example.

Meta controls the native animation. It disappears when a response is sent or after 25 seconds, whichever happens first. This change does not stream partial response text into WhatsApp.

Reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/typing-indicators

## Validation

Seven focused regression tests pass, covering the HTTP payload, feedback deadline, ordering and deduplication, Redis cooldown and recovery, production memory behavior, async generation, and generation deadline.

The original isolated latency release was compared against the uploaded source of revision `yell-ai-api-00021-79g`: only the four intended service/webhook files differed. After adding login gating and persistent storage and restoring campaign administration guards, all 74 backend tests pass.

A standalone live Gemini probe returned in 4.3 seconds. This is not a full conversational latency measurement.

## Activated release

The user approved activation before the database move. Login gating and typing support were first activated on revision `yell-ai-api-00024-giw`; PostgreSQL-backed revision `yell-ai-api-00026-piz` completed the initial persistent-storage cutover. Subsequent releases retain PostgreSQL and record their source commit in the Cloud Run `git-sha` label. Temporary rollout preview tags are removed after activation.

Live smoke checks passed: `/health` returns 200, a correctly signed empty webhook returns 200/ignored, and an unsigned webhook returns 401. `/ready` still returns 503 because Redis is unavailable; the PostgreSQL database check passes.

## Remaining latency and rollout constraints

- Action requests still make sequential emotion, intent, and task-generation calls. Tool-provider requests can add further time.
- The hosted service has no working shared Redis connection. The retry change avoids repeated waits; it does not provision Redis.
- Cloud Run currently scales to zero and uses request-based CPU. Background processing after an HTTP acknowledgement can be delayed; a durable worker or explicit CPU/scaling configuration needs a separate infrastructure decision.
- Account storage now uses managed PostgreSQL with backups; verified login bindings and account records survive container replacement. Redis conversation memory is still a separate service.
- No new WhatsApp test message has been sent during this work. The animation still needs an actual phone-side check after activation.

