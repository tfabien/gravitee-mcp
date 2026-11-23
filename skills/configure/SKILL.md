---
name: configure
description: "Open the local page to add, edit, test or remove the Gravitee organizations (tenant + environment, with URL and token). Run it when no organization is configured or when the tenant or environment the user needs is missing."
disable-model-invocation: true
---

# Configure the Gravitee organizations

1. Start the configuration page in the background with the Bash tool (`run_in_background`):
   `node "${CLAUDE_PLUGIN_ROOT}/configure.mjs"`
2. Read its output: the first line holds the address to open (`http://127.0.0.1:<port>/?k=<key>`).
3. Open that address in the built-in browser (`navigate`). If no browser tool is available, give the address to the user to open.
4. Tell the user, in one or two sentences: add or edit the rows (name, URL, token), use **Test** to check a token, then **Save**;
   Claude picks the change up immediately, with no restart; **Done** stops the page.

Never read the configuration file, never print a token, and never ask the user to paste a token in the chat: tokens are typed in the page only.
