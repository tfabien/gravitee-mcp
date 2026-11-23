// MCP proxy in front of @gravitee/apim-mcp-server (npm): one organization (tenant + environment) = one management URL + one token,
// one official server instance per organization, started on first use. Every tool gets an "organization" parameter.
// Organizations come from ~/.claude/gravitee-mcp.json (edited with /gravitee-mcp:configure) and are hot-reloaded.
// Also adds list_environments (absent from the official server, Management API v1) and list_organizations.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { statSync } from 'node:fs'
import { CONFIGURE_HINT, checkEntry, configPath, readConfig } from './config.mjs'

const PKG = '@gravitee/apim-mcp-server@0.2.1'

// --- organizations (reloaded when the file changes) ---
const ups = new Map() // name -> { org, pending, seq, ready, child, dead }
let names = []
let problems = []
let stamp
let started = false

function refresh() {
  const file = configPath()
  let mtime = null
  try { mtime = statSync(file).mtimeMs } catch {}
  if (started && mtime === stamp) return false
  stamp = mtime
  started = true
  const next = new Map()
  problems = []
  let conf = {}
  try { conf = readConfig(file) } catch (e) { problems.push(e.message) }
  for (const [name, o] of Object.entries(conf)) {
    const err = checkEntry(name, o?.url, o?.token)
    if (err) problems.push(`${file} : ${err}`)
    else next.set(name, { name, url: o.url.replace(/\/+$/, ''), token: o.token })
  }
  for (const [n, up] of ups) {
    const o = next.get(n)
    if (!o || o.url !== up.org.url || o.token !== up.org.token) { up.child?.stdin.end(); ups.delete(n) }
  }
  for (const [n, o] of next) if (!ups.has(n)) ups.set(n, { org: o, pending: new Map(), seq: 0, ready: null })
  const changed = names.join() !== [...next.keys()].join()
  names = [...next.keys()]
  return changed
}
refresh()

const out = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n')
const toolText = (id, text, isError = false) => out({ id, result: { isError, content: [{ type: 'text', text }] } })
const toolError = (id, text) => toolText(id, text, true)
const noOrg = () => new Error(`No organization configured: ${CONFIGURE_HINT}.`)

// --- official server instances ---
let initParams = null
let startLock = Promise.resolve() // sequential starts: several parallel "npx -y" fight over the npm cache

function call(up, method, params) {
  return new Promise((resolve, reject) => {
    if (up.dead) return reject(new Error(up.dead))
    const id = ++up.seq
    up.pending.set(id, { resolve, reject })
    up.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

async function boot(up) {
  const { org } = up
  const child = spawn('npx', ['-y', PKG, 'start', '--bearer-auth', org.token, '--server-url', org.url],
    { stdio: ['pipe', 'pipe', 'inherit'], shell: process.platform === 'win32' })
  up.child = child
  const dead = (why) => {
    up.dead ??= `organization "${org.name}" unavailable: ${why}`
    for (const p of up.pending.values()) p.reject(new Error(up.dead))
    up.pending.clear()
  }
  child.on('error', (e) => dead(e.message))
  child.on('exit', (code) => dead(`server exited (code ${code})`))
  child.stdin.on('error', () => {})
  createInterface({ input: child.stdout }).on('line', (line) => {
    let m; try { m = JSON.parse(line) } catch { return }
    const p = m.id != null && up.pending.get(m.id)
    if (p) { up.pending.delete(m.id); p.resolve(m) }
  })
  const init = await call(up, 'initialize', initParams)
  if (init.error) throw new Error(`organization "${org.name}": ${init.error.message}`)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
}

function ensure(up) {
  up.ready ??= (async () => {
    const prev = startLock
    let release
    startLock = new Promise((r) => { release = r })
    await prev
    try { await boot(up) } finally { release() }
  })()
  return up.ready
}

async function firstUp() {
  if (!ups.size) throw noOrg()
  for (const up of ups.values()) { try { await ensure(up); return up } catch {} }
  throw new Error('no organization available (see the server errors)')
}

// --- added / modified tools ---
const orgProp = () => ({
  type: 'string',
  enum: names,
  description: `Gravitee organization to query (one tenant + environment, e.g. mycompany-prod). See list_organizations. If the one you need is not listed, do not guess: tell the user to ${CONFIGURE_HINT}.`,
})
const withOrg = (t) => {
  if (names.length < 2) return t
  const s = t.inputSchema ?? { type: 'object' }
  return { ...t, inputSchema: { ...s, properties: { organization: orgProp(), ...s.properties }, required: ['organization', ...(s.required ?? [])] } }
}
const LIST_ENV = {
  name: 'list_environments',
  description: 'List the environments (id, name) of the selected Gravitee organization (tenant). Use the id as envId in the other tools. orgId is optional (legacy v1 listing for a given Gravitee organization id); leave it out in general.',
  inputSchema: { type: 'object', properties: { orgId: { type: 'string' } } },
}
const LIST_ORGS = {
  name: 'list_organizations',
  description: `List the configured Gravitee organizations (tenant + environment pairs: count, name, Management API URL). Pass the name as "organization" to the other tools. If none is configured or the one needed is missing, tell the user to ${CONFIGURE_HINT}.`,
  inputSchema: { type: 'object', properties: {} },
}

function pick(organization) {
  if (!names.length) throw noOrg()
  const up = ups.get(organization ?? (names.length > 1 ? undefined : names[0]))
  if (up) return up
  throw new Error(organization
    ? `Unknown organization "${organization}". Configured: ${names.join(', ')}. To add it: ${CONFIGURE_HINT}.`
    : `"organization" parameter required, one of: ${names.join(', ')}.`)
}

async function callTool(m) {
  const { name, arguments: { organization, ...args } = {} } = m.params
  if (name === LIST_ORGS.name) {
    const info = { count: names.length, organizations: names.map((n) => ({ name: n, url: ups.get(n).org.url })) }
    if (problems.length) info.problems = problems
    if (!names.length || problems.length) info.hint = `To configure: ${CONFIGURE_HINT}.`
    return toolText(m.id, JSON.stringify(info))
  }
  let up
  try { up = pick(organization) } catch (e) { return toolError(m.id, e.message) }
  if (name === LIST_ENV.name) {
    // without orgId: v2 /environments endpoint (works whatever the tenant's organization id)
    const endpoint = args.orgId ? `${up.org.url.replace(/\/v2$/, '')}/organizations/${encodeURIComponent(args.orgId)}/environments` : `${up.org.url}/environments`
    try {
      const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${up.org.token}` } })
      const body = await r.text()
      return toolText(m.id, r.ok ? body : `HTTP ${r.status}: ${body.slice(0, 500)}`, !r.ok)
    } catch (e) { return toolError(m.id, String(e)) }
  }
  try {
    await ensure(up)
    const r = await call(up, 'tools/call', { ...m.params, arguments: args })
    out({ id: m.id, result: r.result, error: r.error })
  } catch (e) { toolError(m.id, e.message) }
}

let initialized = false

async function handle(m) {
  if (m.id == null || !m.method) return // client notifications and responses: not relayed
  if (refresh() && initialized) out({ method: 'notifications/tools/list_changed' })
  try {
    if (m.method === 'initialize') {
      initParams = m.params
      initialized = true
      // immediate reply (the client connection timeout is 30 s, a slow npx would exceed it); the instance starts in the background
      if (ups.size) firstUp().catch(() => {})
      return out({ id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? '2025-03-26', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'GraviteeApim', version: '0.1.0' } } })
    }
    if (m.method === 'ping') return out({ id: m.id, result: {} })
    if (m.method === 'tools/call') return await callTool(m)
    if (m.method === 'tools/list' && !ups.size) return out({ id: m.id, result: { tools: [LIST_ORGS] } })
    const r = await call(await firstUp(), m.method, m.params)
    if (m.method === 'tools/list' && r.result?.tools) {
      r.result.tools = r.result.tools.map(withOrg)
      if (!r.result.nextCursor) r.result.tools.push(withOrg(LIST_ENV), LIST_ORGS)
    }
    out({ id: m.id, result: r.result, error: r.error })
  } catch (e) { out({ id: m.id, error: { code: -32603, message: e.message } }) }
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => { let m; try { m = JSON.parse(line) } catch { return } handle(m) })
rl.on('close', () => {
  for (const up of ups.values()) up.child?.stdin.end()
  setTimeout(() => process.exit(0), 2000)
})
