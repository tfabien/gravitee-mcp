---
name: gravitee
description: Query the Gravitee APIM gateway (Management API v2) through the gravitee-apim MCP tools - find APIs, read request logs, analytics, response codes and latency, audits and subscriptions. Use for any question about what happened on the gateway (who called which API, when, with what status).
---

# Gravitee APIM

Use the `gravitee-apim` MCP tools. Default to read-only tools: `search_apis`, `list_apis`, `get_api`,
`get_api_logs`, `get_api_log`, `get_api_analytics_request_count`, `get_response_status_codes`,
`get_api_audits`, `get_api_subscriptions`.

- A configured "organization" is one tenant + environment pair, each with its own management URL and token. An API is only visible in the pair that hosts it; if a search is empty, check the other configured organizations before concluding it does not exist.
- Several Gravitee organizations may be configured: when the tools have an `organization` parameter, call `list_organizations` and ask the user which one if it is not obvious. API ids are specific to an organization: never reuse an id from one in another.
- If no organization is configured, or the tenant/environment the user needs is not in `list_organizations`, do not guess a name: tell the user to run `/gravitee-mcp:configure` (it adds, edits and tests organizations; the change is picked up immediately, no restart).
- Find the API id first (`search_apis`), then query its logs or analytics.
- Gravitee timestamps and time ranges are UTC: convert from/to the user's local time zone and say which one you show.
- Detailed request logs exist only if logging is enabled on the API for that period: an empty result does not prove there was no call.
- Never call a write tool (`create_*`, `update_*`, `patch_*`, `delete_*`, `start_api`, `stop_api`, `rollback_api`, `promote_api`, member/subscription changes) without explicit confirmation from the user.
- Separate what the logs show from what you infer.
