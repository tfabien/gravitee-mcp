# gravitee-mcp

Claude Code plugin that exposes Gravitee APIM (Management API v2) to Claude: analytics, request logs and API configuration of the gateway, across several tenants and environments.

It wraps the official [`@gravitee/apim-mcp-server`](https://www.npmjs.com/package/@gravitee/apim-mcp-server) npm package, started through `npx` (one instance per organization, started on first use). Read-only by default: Claude asks for confirmation before any write tool.

## Requirements

- Claude Code
- Node.js 18 or later (`node` and `npx` on the PATH)
- A Gravitee Management API v2 URL and an access token for each tenant and environment you want to query

## Installation

The repository is a single-plugin marketplace. In Claude Code:

```
/plugin marketplace add tfabien/gravitee-mcp
/plugin install gravitee-mcp@gravitee-mcp
```

The repository is private: `git` must be authenticated for GitHub (for example with `gh auth login`). Restart Claude Code or run `/reload-plugins` after installing.

## Configuration

Run **`/gravitee-mcp:configure`**. It opens a local page (bound to 127.0.0.1, protected by a random key) with:

- one row per organization: name, Management API URL, token
- a **Test** button per row that calls `<url>/environments` with the token
- a **Save** button

An organization is one tenant + environment pair, for example `mycompany-prod`, with its own URL (`https://<host>/management/v2`) and its own token.

Changes are picked up immediately, no restart. They are stored in `~/.claude/gravitee-mcp.json` (file mode 600):

```json
{
  "mycompany-prod": { "url": "https://your-gravitee-host/management/v2", "token": "..." },
  "mycompany-staging": { "url": "https://your-staging-host/management/v2", "token": "..." }
}
```

The file can also be edited by hand. Set `GRAVITEE_ORGANIZATIONS_FILE` to use another path.

Tokens are never displayed or returned to Claude: an empty token field keeps the saved token. Nothing leaves your machine except calls to each organization's own URL.

At session start, Claude suggests `/gravitee-mcp:configure` when nothing is configured, and again when a requested organization is missing.

## Usage

- With a single organization, tools work as in the official server.
- With several, every tool takes a required `organization` parameter (the name from the config). `list_organizations` returns the configured names and URLs, never the tokens.
- `list_environments` is added by this plugin (absent from the official server). Its optional `orgId` is the Gravitee organization id (for example `DEFAULT`), not the `organization` name above.
- An organization that fails to start (bad URL, offline) only breaks its own calls.

The bundled `gravitee` skill tells Claude how to query logs and analytics (UTC time ranges, logging caveats, confirmation before write tools).

## License

MIT, see [LICENSE](LICENSE).
