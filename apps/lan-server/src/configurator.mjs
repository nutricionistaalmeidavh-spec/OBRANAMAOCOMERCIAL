/**
 * Local-only, opt-in configuration UI for the separately installed Obra na Mão Server.
 * Does not run in the public server process or expose a remote administration route.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const SETUP_PORT = 4734
const FIELDS = Object.freeze({
  OBRA_NA_MAO_SERVER_MODE: 'remote',
  OBRA_NA_MAO_SERVER_TRANSPORT: 'reverse-proxy',
  OBRA_NA_MAO_SERVER_HOST: '127.0.0.1'
})

function envEntries(content) {
  const map = new Map()
  for (const line of String(content).split(/\r?\n/)) {
    const matched = line.match(/^([A-Z][A-Z_0-9]*)=(.*)$/)
    if (matched) map.set(matched[1], matched[2])
  }
  return map
}

function defaultConfigPath() {
  return process.platform === 'win32'
    ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'ArtiSys', 'Obra na Mão Server', 'config', 'server.env')
    : '/etc/obra-na-mao/server.env'
}

function resolveDataDir(content, configPath) {
  const existing = envEntries(content).get('OBRA_NA_MAO_SERVER_DATA_DIR')
  if (!existing) return process.platform === 'win32'
    ? path.join(path.dirname(path.dirname(configPath)), 'data')
    : '/var/lib/obra-na-mao'
  const expanded = existing.replace(/%ProgramData%/gi, process.env.ProgramData || 'C:\\ProgramData')
  return path.resolve(expanded)
}

export function validateServerSettings({ publicUrl, port } = {}) {
  const rawUrl = String(publicUrl ?? '').trim()
  if (rawUrl.length > 2048 || !rawUrl) throw new Error('Informe o endereço HTTPS disponibilizado pelo cliente.')
  let target
  try { target = new URL(rawUrl) } catch { throw new Error('Endereço HTTPS inválido.') }
  if (target.protocol !== 'https:' || !target.hostname || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Use apenas o endereço HTTPS do servidor, sem usuário, senha, caminho ou parâmetros.')
  }
  if (/[\s\\]/.test(rawUrl)) throw new Error('Endereço HTTPS inválido.')
  const numericPort = Number(port)
  if (!/^\d{1,5}$/.test(String(port)) || !Number.isSafeInteger(numericPort) || numericPort < 1 || numericPort > 65535 || numericPort === SETUP_PORT) {
    throw new Error('Informe uma porta TCP válida e diferente da porta reservada para configuração (4734).')
  }
  return { publicUrl: target.origin, port: numericPort }
}

export function mergeServerSettings(content, input) {
  const { publicUrl, port } = validateServerSettings(input)
  const crlf = String(content).includes('\r\n')
  const newline = crlf ? '\r\n' : '\n'
  const original = String(content)
  const finalNewline = /\r?\n$/.test(original)
  const updates = new Map(Object.entries({
    ...FIELDS,
    OBRA_NA_MAO_SERVER_PORT: String(port),
    OBRA_NA_MAO_SERVER_PUBLIC_URL: publicUrl
  }))
  const written = new Set()
  const lines = original.split(/\r?\n/).filter((line, index, all) => index < all.length - 1 || line !== '')
  const merged = lines.filter(line => {
    const key = line.match(/^([A-Z][A-Z_0-9]*)=/)?.[1]
    if (!key || !updates.has(key)) return true
    if (written.has(key)) return false
    written.add(key)
    return true
  }).map(line => {
    const key = line.match(/^([A-Z][A-Z_0-9]*)=/)?.[1]
    return key && updates.has(key) ? `${key}=${updates.get(key)}` : line
  })
  for (const [key, value] of updates) if (!written.has(key)) merged.push(`${key}=${value}`)
  return `${merged.join(newline)}${finalNewline ? newline : ''}`
}

function writeAtomically(configPath, content) {
  const stat = fs.statSync(configPath)
  const tmp = `${configPath}.setup-${randomBytes(8).toString('hex')}.tmp`
  try {
    fs.writeFileSync(tmp, content, { mode: stat.mode & 0o777, flag: 'wx' })
    if (process.platform !== 'win32') {
      fs.chmodSync(tmp, stat.mode & 0o777)
      fs.chownSync(tmp, stat.uid, stat.gid)
    }
    fs.renameSync(tmp, configPath)
  } finally {
    try { fs.unlinkSync(tmp) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}

export function writeServerConfig(configPath, input) {
  const before = fs.readFileSync(configPath, 'utf8')
  const after = mergeServerSettings(before, input)
  writeAtomically(configPath, after)
  return { before, after }
}

export function generateClaimCode(dbPath) {
  if (!fs.existsSync(dbPath)) throw new Error('Banco do servidor não encontrado. Inicie o serviço antes de gerar o código.')
  const db = new DatabaseSync(dbPath)
  try {
    const entry = db.prepare('SELECT id, company_id FROM lan_server_identity WHERE id=1').get()
    if (!entry) throw new Error('Servidor ainda não inicializado.')
    if (entry.company_id) throw new Error('Este servidor já está vinculado a uma empresa.')
    const raw = randomBytes(5).toString('hex').toUpperCase()
    const code = `${raw.slice(0, 5)}-${raw.slice(5)}`
    const hash = createHash('sha256').update(code).digest('hex')
    const updated = db.prepare('UPDATE lan_server_identity SET setup_code_hash=? WHERE id=1 AND company_id IS NULL').run(hash)
    if (updated.changes !== 1) throw new Error('Não foi possível gerar o código para servidor não vinculado.')
    return code
  } finally { db.close() }
}

function bearerMatches(actual, expected) {
  const left = Buffer.from(String(actual || ''), 'utf8')
  const right = Buffer.from(expected, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

async function readBody(request) {
  let text = ''
  for await (const chunk of request) {
    text += chunk.toString('utf8')
    if (text.length > 8192) throw new Error('Solicitação muito grande.')
  }
  try { return JSON.parse(text) } catch { throw new Error('Dados de configuração inválidos.') }
}

async function restartInstalledService() {
  if (process.platform === 'win32') {
    const script = path.resolve(import.meta.dirname, '../../platform/service-control.ps1')
    await execFileAsync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Action','Restart'])
  } else {
    await execFileAsync('systemctl', ['restart','obra-na-mao-server.service'])
  }
}

async function waitForLocalReady(port, fetchImpl=fetch) {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetchImpl(`http://127.0.0.1:${port}/ready`, {signal: AbortSignal.timeout(750)})
      if (response.ok && (await response.json())?.ready === true) return true
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('O serviço não respondeu como pronto após a alteração. A configuração anterior será restaurada.')
}

export async function verifyPublicServer(publicUrl, { fetchImpl=fetch } = {}) {
  const url = validateServerSettings({publicUrl, port: 4732}).publicUrl
  let response
  try {
    response = await fetchImpl(`${url}/ready`, {redirect:'manual',signal:AbortSignal.timeout(8000)})
  } catch { throw new Error('Endereço HTTPS indisponível. Confirme o encaminhamento com o administrador da infraestrutura.') }
  if (!response.ok) throw new Error('O endereço respondeu, mas não encontrou um serviço Obra na Mão pronto.')
  try {
    const data = await response.json()
    if (data?.ready !== true || !data?.identity?.serverId) throw new Error('Resposta de servidor incompatível.')
    return { ready: true, serverId: String(data.identity.serverId) }
  } catch { throw new Error('A URL HTTPS não retornou o status esperado do Obra na Mão Server.') }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'})
  response.end(JSON.stringify(payload))
}

export function createSetupApp({ configPath=defaultConfigPath(), token=randomBytes(32).toString('hex'), restart=restartInstalledService, verifyReady=waitForLocalReady, verifyPublic=verifyPublicServer, claimCode=generateClaimCode }={}) {
  let busy = false
  const server = http.createServer(async (request, response) => {
    const boundPort = server.address()?.port || SETUP_PORT
    const base = `http://127.0.0.1:${boundPort}`
    const badHost = request.headers.host !== `127.0.0.1:${boundPort}`
    const notLocal = !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
    if (badHost || notLocal) return sendJson(response,403,{error:'Configuração disponível somente no próprio servidor.'})
    const url = new URL(request.url, base)
    const isPage = request.method === 'GET' && url.pathname === '/'
    const authenticated = bearerMatches(isPage ? url.searchParams.get('token') : request.headers['x-setup-token'], token)
    if (!authenticated) return sendJson(response, 403, {error:'Sessão de configuração inválida.'})
    if (isPage) {
      response.writeHead(200,{
        'content-type':'text/html; charset=utf-8','cache-control':'no-store',
        'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
        'x-content-type-options':'nosniff','referrer-policy':'no-referrer', 'x-frame-options':'DENY'
      })
      return response.end(fs.readFileSync(path.join(import.meta.dirname,'configurator-ui.html'),'utf8'))
    }
    if (request.method === 'GET' && url.pathname === '/api/status') {
      try {
        const env = envEntries(fs.readFileSync(configPath,'utf8'))
        return sendJson(response,200,{
          mode:env.get('OBRA_NA_MAO_SERVER_MODE')||'lan',
          port:Number(env.get('OBRA_NA_MAO_SERVER_PORT')||4732),
          publicUrl:env.get('OBRA_NA_MAO_SERVER_PUBLIC_URL')||''
        })
      } catch { return sendJson(response,500,{error:'Arquivo de configuração do serviço não encontrado.'}) }
    }
    if (request.method !== 'POST' || !['/api/save','/api/verify','/api/claim-code'].includes(url.pathname)) return sendJson(response,404,{error:'Rota não encontrada.'})
    if (request.headers.origin !== base) return sendJson(response,403,{error:'Origem inválida.'})
    if (busy) return sendJson(response,409,{error:'Aguarde a operação atual terminar.'})
    busy=true
    try {
      if (url.pathname === '/api/claim-code') {
        const content=fs.readFileSync(configPath,'utf8')
        const dbPath=path.join(resolveDataDir(content,configPath),'obra-na-mao-lan.sqlite')
        return sendJson(response,200,{ code: claimCode(dbPath) })
      }
      const payload=await readBody(request)
      if (url.pathname==='/api/verify') return sendJson(response,200,await verifyPublic(payload.publicUrl))
      const settings=validateServerSettings(payload)
      const previous=fs.readFileSync(configPath,'utf8')
      const current=mergeServerSettings(previous,settings)
      if (current !== previous) {
        writeAtomically(configPath,current)
        try {
          await restart()
          await verifyReady(settings.port)
        } catch (failure) {
          writeAtomically(configPath,previous)
          try { await restart() } catch {}
          throw failure
        }
      }
      return sendJson(response,200,{ saved:true, port:settings.port, publicUrl:settings.publicUrl })
    } catch (error) {
      const status = error.message?.match(/inválid|HTTPS|porta|endereço|vinculad|não inicializado/i) ? 400 : 500
      return sendJson(response,status,{error: String(error.message || 'Falha de configuração.')})
    } finally { busy=false }
  })
  return server
}

export async function runConfigurator() {
  const configPath=defaultConfigPath()
  if (!fs.existsSync(configPath)) throw new Error('Instale o Obra na Mão Server antes de abrir este configurador.')
  if (typeof process.getuid === 'function' && process.getuid() !== 0) throw new Error('Execute o configurador com sudo: sudo obra-na-mao-configurar')
  fs.accessSync(configPath,fs.constants.R_OK|fs.constants.W_OK)
  const token=randomBytes(32).toString('hex')
  const app=createSetupApp({configPath,token})
  await new Promise((resolve,reject)=>{
    app.once('error',reject)
    app.listen(SETUP_PORT,'127.0.0.1',resolve)
  })
  const link=`http://127.0.0.1:${SETUP_PORT}/?token=${token}`
  process.stdout.write(`\nObra na Mão Server — Configuração protegida\n\nAbra no próprio servidor: ${link}\n\nLinux remoto: faça um túnel SSH -L ${SETUP_PORT}:127.0.0.1:${SETUP_PORT} antes de abrir esse link no seu navegador.\nAo terminar, feche esta janela (Ctrl+C).\n\n`)
  if (process.platform === 'win32') {
    const browser=spawn('explorer.exe',[link],{stdio:'ignore',detached:true})
    browser.on('error',()=>{})
    browser.unref()
  }
  process.on('SIGINT',()=>app.close(()=>process.exit(0)))
  process.on('SIGTERM',()=>app.close(()=>process.exit(0)))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runConfigurator().catch(error=>{ console.error(error.message); process.exitCode=1 })
}
