# Shared backend and connections

Build the integration layer before choosing personal, hiring, or marketing positioning.

1. Replace placeholder Composio behavior with provider-verified OAuth status, owner-scoped connections, errors, and disconnect. Retain existing entity IDs and connector APIs where possible.
2. Add configurable HubSpot, Salesforce, and Pipedrive alongside existing apps. Keep project authentication configuration and user OAuth consent separate; never pretend unconfigured CRM accounts are connected.
3. Expose authenticated tool discovery and durable tool runs. Resolve a concrete tool version, bind each run to a connection and verified owner, and require an explicit approval request before execution. Preserve provider failures and ambiguous timeouts; never automatically repeat an external write.
4. Close the unauthenticated legacy connector endpoints and route the old connection page to the existing verified login/dashboard.
5. Validate with isolated SQLite, mocked provider responses, authentication/ownership tests, live provider metadata reads, and the frontend build. No live CRM writes or outgoing messages are part of validation.

The existing chat prompts and product positioning stay outside this change. Agent planners can call the same services later. Workflow scheduling, webhooks/triggers, team workspaces, and media generation are subsequent capabilities, not implemented by this connection layer.
