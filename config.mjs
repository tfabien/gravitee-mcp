// Gravitee organizations config file, shared by server.mjs and configure.mjs.
// Format: { "name": { "url": "https://.../management/v2", "token": "..." } }, one entry = one tenant + one environment.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const URL_RE = /^https?:\/\/[\w.~:\/%+=-]+$/
export const TOKEN_RE = /^[\w.~+\/=-]+$/
export const NAME_RE = /^[\w-]+$/
export const CONFIGURE_HINT = 'run /gravitee-mcp:configure to add or edit an organization'

const DEFAULT_FILE = join(homedir(), '.claude', 'gravitee-mcp.json')

// File used: GRAVITEE_ORGANIZATIONS_FILE, else ~/.claude/gravitee-mcp.json, else the legacy ~/.gravitee-mcp.json.
export function configPath() {
  return [process.env.GRAVITEE_ORGANIZATIONS_FILE, DEFAULT_FILE, join(homedir(), '.gravitee-mcp.json')].find((f) => f && existsSync(f))
    ?? process.env.GRAVITEE_ORGANIZATIONS_FILE ?? DEFAULT_FILE
}

// { name: { url, token } }; {} if the file does not exist. Throws an Error if the JSON is invalid.
export function readConfig(file = configPath()) {
  if (!existsSync(file)) return {}
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (e) { throw new Error(`${file} : invalid JSON (${e.message})`) }
}

// Returns the error message for an entry, or null if it is valid.
export function checkEntry(name, url, token) {
  if (!NAME_RE.test(name ?? '')) return `invalid name "${name ?? ''}" (letters, digits, _ and - only)`
  if (!URL_RE.test(url ?? '')) return `invalid URL for "${name}"`
  if (!TOKEN_RE.test(token ?? '')) return `missing or invalid token for "${name}"`
  return null
}

export function writeConfig(conf, file = configPath()) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(conf, null, 2) + '\n', { mode: 0o600 })
}
