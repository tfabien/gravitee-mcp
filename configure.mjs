// Local UI to edit the Gravitee organizations (~/.claude/gravitee-mcp.json): name / URL / token table,
// a "Test" button per row. Served on 127.0.0.1 only, protected by a random key;
// tokens are never sent back to the page (an empty token field keeps the stored token).
// Usage: node configure.mjs   (prints the address to open; Ctrl+C or the "Done" button stops it)
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { checkEntry, configPath, readConfig, writeConfig } from './config.mjs'

const key = randomBytes(16).toString('hex')
const IDLE_MS = 30 * 60 * 1000
let idle
const touch = () => { clearTimeout(idle); idle = setTimeout(() => process.exit(0), IDLE_MS) }

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)) }
const readBody = (req) => new Promise((resolve, reject) => {
  let s = ''
  req.on('data', (d) => { s += d; if (s.length > 200_000) { reject(new Error('body too large')); req.destroy() } })
  req.on('end', () => { try { resolve(JSON.parse(s || '{}')) } catch { reject(new Error('invalid JSON')) } })
})

async function testEntry({ name, url, token }, stored) {
  const t = token || stored[name]?.token
  const err = checkEntry(name || 'test', url, t)
  if (err) return { ok: false, message: err }
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/environments', { headers: { Authorization: 'Bearer ' + t }, signal: AbortSignal.timeout(15000) })
    if (r.status === 401 || r.status === 403) return { ok: false, message: 'token rejected (HTTP ' + r.status + ')' }
    if (!r.ok) return { ok: false, message: 'HTTP ' + r.status }
    const body = await r.json().catch(() => null)
    const list = Array.isArray(body) ? body : body?.data
    return { ok: true, message: Array.isArray(list) ? 'OK - ' + list.length + ' environment(s) visible' : 'OK' }
  } catch (e) { return { ok: false, message: 'unreachable: ' + (e.cause?.code ?? e.message) } }
}

const server = createServer(async (req, res) => {
  touch()
  const { port } = server.address()
  const u = new URL(req.url, 'http://127.0.0.1')
  if (req.headers.host !== '127.0.0.1:' + port) return json(res, 403, { error: 'host rejected' })
  if (req.method === 'GET' && u.pathname === '/') {
    if (u.searchParams.get('k') !== key) return json(res, 403, { error: 'invalid key' })
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(PAGE.replace('__KEY__', key))
  }
  if (!u.pathname.startsWith('/api/') || req.headers['x-key'] !== key) return json(res, 403, { error: 'access denied' })
  try {
    const file = configPath()
    if (req.method === 'GET' && u.pathname === '/api/config') {
      const conf = readConfig(file)
      return json(res, 200, { file, orgs: Object.entries(conf).map(([name, o]) => ({ name, url: o?.url ?? '', hasToken: !!o?.token })) })
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
    const body = await readBody(req)
    if (u.pathname === '/api/test') return json(res, 200, await testEntry(body, readConfig(file)))
    if (u.pathname === '/api/exit') { json(res, 200, { ok: true }); return setTimeout(() => process.exit(0), 200) }
    if (u.pathname === '/api/config') {
      const stored = readConfig(file)
      const next = {}
      const errors = []
      for (const o of body.orgs ?? []) {
        const name = String(o.name ?? '').trim()
        const url = String(o.url ?? '').trim().replace(/\/+$/, '')
        const token = String(o.token ?? '').trim() || stored[name]?.token
        const err = checkEntry(name, url, token)
        if (err) errors.push(err)
        else if (next[name]) errors.push('duplicate name: "' + name + '"')
        else next[name] = { url, token }
      }
      if (errors.length) return json(res, 400, { errors })
      writeConfig(next, file)
      return json(res, 200, { ok: true, file, count: Object.keys(next).length })
    }
    json(res, 404, { error: 'unknown' })
  } catch (e) { json(res, 500, { errors: [e.message] }) }
})

server.listen(0, '127.0.0.1', () => {
  touch()
  console.log('Gravitee configuration UI: http://127.0.0.1:' + server.address().port + '/?k=' + key)
  console.log('Edited file: ' + configPath())
})

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gravitee organizations</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#1c2330;--mute:#667085;--line:#e3e7ee;--acc:#2f6fed;--ok:#157f4b;--ko:#c0352b;--field:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--card:#1c2027;--fg:#e8ecf3;--mute:#9aa4b5;--line:#2c333f;--acc:#6b9bff;--ok:#4cc38a;--ko:#ff7b72;--field:#14171c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:28px 16px 60px}h1{font-size:20px;margin:0 0 4px}
.sub{color:var(--mute);margin:0 0 20px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
table{width:100%;border-collapse:collapse}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);text-align:left;padding:0 6px 8px}
td{padding:5px 6px;vertical-align:top}input,select{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:7px;background:var(--field);color:var(--fg);font:inherit}
input:focus,select:focus{outline:2px solid var(--acc);outline-offset:-1px}
button{font:inherit;padding:8px 12px;border-radius:7px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
button:hover{border-color:var(--acc)}button.primary{background:var(--acc);border-color:var(--acc);color:#fff}
button.x{padding:8px 10px;color:var(--ko)}.res{font-size:13px;margin-top:3px;min-height:18px}.ok{color:var(--ok)}.ko{color:var(--ko)}
.bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px}.grow{flex:1}.add{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.add select{width:auto}#msg{margin-top:12px;font-weight:600}.mute{color:var(--mute);font-size:13px}code{background:var(--bg);padding:1px 5px;border-radius:4px}
.w-name{width:20%}.w-url{width:46%}.w-tok{width:24%}.w-act{width:10%;white-space:nowrap}
@media (max-width:760px){table,tbody,tr,td,th{display:block;width:100%}thead{display:none}tr{border-bottom:1px solid var(--line);padding:8px 0}}
</style></head><body><main>
<h1>Gravitee organizations</h1>
<p class="sub">One organization = one tenant + one environment = one management URL + its own token. <span class="mute" id="file"></span></p>
<div class="card">
<table><thead><tr><th class="w-name">Name</th><th class="w-url">Management URL</th><th class="w-tok">Token</th><th class="w-act"></th></tr></thead><tbody id="rows"></tbody></table>
<div class="add"><button id="addBlank">+ Add an organization</button></div>
<div class="bar"><button class="primary" id="save">Save</button><button id="exit">Done</button><span class="grow"></span>
<span class="mute">Picked up immediately by Claude, no restart.</span></div>
<div id="msg"></div></div>
<p class="mute">Tokens are never displayed: an empty field keeps the stored token. The file is stored locally; nothing is sent anywhere except to each organization's URL (Test button).</p>
<script>
var KEY="__KEY__",rows=[];
function api(path,body){return fetch(path,{method:body?"POST":"GET",headers:{"x-key":KEY,"content-type":"application/json"},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json().then(function(j){return {status:r.status,body:j}})})}
function el(tag,attrs,kids){var e=document.createElement(tag);for(var k in attrs||{}){if(k==="class")e.className=attrs[k];else e[k]=attrs[k]}(kids||[]).forEach(function(c){e.appendChild(typeof c==="string"?document.createTextNode(c):c)});return e}
function render(){var tb=document.getElementById("rows");tb.innerHTML="";rows.forEach(function(r,i){
var name=el("input",{value:r.name,placeholder:"mycompany-prod",spellcheck:false});name.oninput=function(){r.name=name.value};
var url=el("input",{value:r.url,placeholder:"https://your-gravitee-host/management/v2",spellcheck:false});url.oninput=function(){r.url=url.value};
var tok=el("input",{type:"password",value:r.token,placeholder:r.hasToken?"saved (empty = keep)":"paste the token",autocomplete:"off"});tok.oninput=function(){r.token=tok.value};
var res=el("div",{class:"res"});
var test=el("button",{textContent:"Test"});test.onclick=function(){res.className="res";res.textContent="...";api("/api/test",{name:r.name,url:r.url,token:r.token}).then(function(x){res.className="res "+(x.body.ok?"ok":"ko");res.textContent=x.body.message||"error"})};
var del=el("button",{class:"x",textContent:"✕",title:"Delete"});del.onclick=function(){rows.splice(i,1);render()};
tb.appendChild(el("tr",{},[el("td",{class:"w-name"},[name]),el("td",{class:"w-url"},[url]),el("td",{class:"w-tok"},[tok,res]),el("td",{class:"w-act"},[test,document.createTextNode(" "),del])]))})}
function say(t,ok){var m=document.getElementById("msg");m.className=ok?"ok":"ko";m.textContent=t}
document.getElementById("addBlank").onclick=function(){rows.push({name:"",url:"",token:"",hasToken:false});render()};
document.getElementById("save").onclick=function(){say("Saving...",true);api("/api/config",{orgs:rows.map(function(r){return {name:r.name,url:r.url,token:r.token}})}).then(function(x){
if(x.status===200){say("Saved: "+x.body.count+" organization(s).",true);load()}else say((x.body.errors||[x.body.error||"error"]).join(" - "),false)})};
document.getElementById("exit").onclick=function(){api("/api/exit",{}).then(function(){document.body.innerHTML="<main><h1>Done</h1><p class='sub'>You can close this tab.</p></main>"})};
function load(){api("/api/config").then(function(x){document.getElementById("file").textContent="File: "+x.body.file;rows=(x.body.orgs||[]).map(function(o){return {name:o.name,url:o.url,token:"",hasToken:o.hasToken}});render()})}
load();
</script></main></body></html>`
