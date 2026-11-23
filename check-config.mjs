// SessionStart: if no Gravitee organization is configured, tell Claude so it suggests /gravitee-mcp:configure.
import { checkEntry, configPath, readConfig } from './config.mjs'

let valid = 0
try { valid = Object.entries(readConfig()).filter(([n, o]) => !checkEntry(n, o?.url, o?.token)).length } catch {}
if (!valid) console.log(`[gravitee-mcp] No Gravitee organization configured (${configPath()}). If the user wants to query Gravitee, suggest running /gravitee-mcp:configure.`)
