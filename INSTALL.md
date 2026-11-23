# Install gravitee-mcp with Claude

This file is written for Claude Code. To install the plugin, paste this into a Claude Code session:

```
Install the gravitee-mcp plugin by following https://raw.githubusercontent.com/tfabien/gravitee-mcp/main/INSTALL.md
```

## Instructions for Claude

Follow the steps in order. Run each command with the Bash tool and stop at the first failure, reporting the error to the user.

### 1. Check the requirements

Run `node --version`. Node.js 18 or later is required. If `node` is missing or older, tell the user to install Node.js 18+ and stop.

### 2. Add the marketplace

```
claude plugin marketplace add tfabien/gravitee-mcp
```

If the marketplace `gravitee-mcp` is already added, continue.

### 3. Install the plugin

```
claude plugin install gravitee-mcp@gravitee-mcp
```

If the plugin is already installed, run `claude plugin list` to confirm it is enabled, and enable it with `claude plugin enable gravitee-mcp` if it is not.

### 4. Reload

Tell the user to run `/reload-plugins` in this session, or to restart Claude Code. Slash commands cannot be run by Claude itself.

### 5. Configure the organizations

After the reload, tell the user to run `/gravitee-mcp:configure`. It opens a local page where they add one row per tenant and environment: a name, the Management API URL (`https://<host>/management/v2`) and a token, then press **Test** and **Save**.

Rules:

- Never ask the user to paste a token in the chat.
- Never read `~/.claude/gravitee-mcp.json` and never print a token.
- Tokens are typed in the local page only.

### 6. Verify

Once the user confirms the configuration is saved, call the `list_organizations` tool of the `gravitee-apim` MCP server and report the configured organization names. Tell the user the plugin is ready.
