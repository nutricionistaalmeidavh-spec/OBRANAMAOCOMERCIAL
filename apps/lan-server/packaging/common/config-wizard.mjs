import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LOOPBACK = '127.0.0.1'
const ADMIN_PORT = 4734
const REPLACEMENTS = ['OBRA_NA_MAO_SERVER_MODE', 'OBRA_NA_MAO_SERVER_TRANSPORT', 'OBRA_NA_MAO_SERVER_HOST', 'OBRA_NA_MAO_SERVER_PORT', 'OBRA_NA_MAO_SERVER_PUBLIC_URL']

export function parseServerEnvironment(source) {
  const result = {}
  for (const line of String(source).split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return result
}

export function validateServerSettings(input) {
  if (!input || typeof input !== 'object') throw new Error('Informe endereço HTTPS e porta interna.')
  const port = Number(input.port)
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === ADMIN_PORT) {
    throw new Error('Informe uma porta interna válida entre 1024 e 65535, diferente da porta do assistente.')
  }
  let url
  try { url = new URL(String(input.publicUrl || '')) } catch { throw new Error('Informe um endereço HTTPS válido fornecido pelo cliente.') }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use um endereço HTTPS completo, sem credenciais, caminhos ou parâmetros.')
  }
  return { port, publicUrl: url.origin }
}

export function updateServerEnvironment(source, settings) {
  const { port, publicUrl } = validateServerSettings(settings)
  const replacements = new Map([
    ['OBRA_NA_MAO_SERVER_MODE', 'remote'],
    ['OBRA_NA_MAO_SERVER_TRANSPORT', 'reverse-proxy'],
    ['OBRA_NA_MAO_SERVER_HOST', LOOPBACK],
    ['OBRA_NA_MAO_SERVER_PORT', String(port)],
    ['OBRA_NA_MAO_SERVER_PUBLIC_URL', publicUrl]
  ])
  const seen = new Set()
  const lines = []
  for (const line of String(source).split(/\r?\n/)) {
    const idx = line.indexOf('=')
    const key = idx < 0 ? '' : line.slice(0, idx).trim()
    if (!replacements.has(key)) { lines.push(line); continue }
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(`${key}=${replacements.get(key)}`)
  }
  for (const key of REPLACEMENTS) if (!seen.has(key)) lines.push(`${key}=${replacements.get(key)}`)
  return lines.join('\n').replace(/\n*$/, '\n')
}

export function writeConfigAtomic(configPath, contents) {
  const original = fs.statSync(configPath)
  const temp = `${configPath}.${crypto.randomBytes(6).toString('hex')}.tmp`
  try {
    fs.writeFileSync(temp, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    if (process.platform !== 'win32') {
      fs.chownSync(temp, original.uid, original.gid)
      fs.chmodSync(temp, original.mode & 0o777)
    }
    fs.renameSync(temp, configPath)
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp)
  }
}

function defaultConfigPath() {
  return process.platform === 'win32'
    ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'ArtiSys', 'Obra na Mão Server', 'config', 'server.env')
    : '/etc/obra-na-mao/server.env'
}

function execute(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Falha ao reiniciar o serviço (código ${code}).`)))
  })
}

async function restartInstalledService() {
  if (process.platform === 'win32') {
    const script = path.join(HERE, 'service-control.ps1')
    await execute('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', 'Restart'])
  } else {
    await execute('systemctl', ['restart', 'obra-na-mao-server.service'])
  }
}

async function readyAt(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${LOOPBACK}:${port}/ready`, { signal: AbortSignal.timeout(1500), redirect: 'manual' })
      const body = await response.json()
      if (response.ok && body?.ready === true && body?.identity?.serverId) return body
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('O serviço não respondeu ao teste local de integridade após reiniciar.')
}

function dataDirFromConfig(config) {
  const raw = config.OBRA_NA_MAO_SERVER_DATA_DIR || (process.platform === 'win32'
    ? '%ProgramData%\\ArtiSys\\Obra na Mão Server\\data' : '/var/lib/obra-na-mao')
  return raw.replace(/%([^%]+)%/g, (_, name) => {
    const key = Object.keys(process.env).find(x => x.toLowerCase() === name.toLowerCase())
    return key ? process.env[key] : `%${name}%`
  })
}

export function issueSetupCode(configPath) {
  const config = parseServerEnvironment(fs.readFileSync(configPath, 'utf8'))
  const databaseFile = path.join(dataDirFromConfig(config), 'obra-na-mao-lan.sqlite')
  if (!fs.existsSync(databaseFile)) throw new Error('Banco do servidor ainda não foi inicializado.')
  const db = new DatabaseSync(databaseFile)
  try {
    const record = db.prepare('SELECT server_id, company_id FROM lan_server_identity WHERE id=1').get()
    if (!record) throw new Error('Servidor ainda não inicializado.')
    if (record.company_id) throw new Error('Servidor já vinculado. Não é necessário outro código inicial.')
    const codeRaw = crypto.randomBytes(5).toString('hex').toUpperCase()
    const code = `${codeRaw.slice(0, 5)}-${codeRaw.slice(5)}`
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const result = db.prepare('UPDATE lan_server_identity SET setup_code_hash=? WHERE id=1 AND company_id IS NULL').run(hash)
    if (result.changes !== 1) throw new Error('Não foi possível gerar o código de vinculação.')
    return { code, serverId: record.server_id }
  } finally { db.close() }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(body)
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > 4096) throw new Error('Solicitação muito grande.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const HTML_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
}

export async function startWizard({ configPath = defaultConfigPath(), port = ADMIN_PORT, restartService = restartInstalledService, probe = readyAt, openBrowser = false } = {}) {
  if (!fs.existsSync(configPath)) throw new Error('Configuração do servidor não encontrada. Instale o Obra na Mão Server primeiro.')
  const secret = crypto.randomBytes(24).toString('hex')
  let busy = false
  const server = http.createServer(async (req, res) => {
    const expectedHost = `${LOOPBACK}:${server.address().port}`
    if (req.headers.host !== expectedHost || req.socket.localAddress !== LOOPBACK) return send(res, 403, { error: 'Acesso permitido somente neste computador.' })
    const requestUrl = new URL(req.url, `http://${expectedHost}`)
    if (req.method === 'GET' && (requestUrl.pathname === '/' || requestUrl.pathname === '/client.js')) {
      if (requestUrl.pathname === '/' && requestUrl.searchParams.get('token') !== secret) return send(res, 403, { error: 'Endereço do assistente inválido.' })
      const file = path.join(HERE, requestUrl.pathname === '/' ? 'config-wizard.html' : 'config-wizard-client.js')
      res.writeHead(200, { ...HTML_HEADERS, 'content-type': requestUrl.pathname === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' })
      return res.end(fs.readFileSync(file))
    }
    if (req.headers['x-setup-token'] !== secret) return send(res, 403, { error: 'Sessão de configuração inválida.' })
    if (req.method === 'POST' && req.headers.origin !== `http://${expectedHost}`) return send(res, 403, { error: 'Origem não autorizada.' })
    try {
      if (req.method === 'GET' && requestUrl.pathname === '/api/state') {
        const env = parseServerEnvironment(fs.readFileSync(configPath, 'utf8'))
        return send(res, 200, { port: Number(env.OBRA_NA_MAO_SERVER_PORT || 4732), publicUrl: env.OBRA_NA_MAO_SERVER_PUBLIC_URL || '', mode: env.OBRA_NA_MAO_SERVER_MODE || 'lan' })
      }
      if (req.method === 'POST' && requestUrl.pathname === '/api/config') {
        if (busy) return send(res, 409, { error: 'Já existe uma configuração em andamento.' })
        busy = true
        try {
          const settings = validateServerSettings(await readJson(req))
          const previous = fs.readFileSync(configPath, 'utf8')
          const next = updateServerEnvironment(previous, settings)
          writeConfigAtomic(configPath, next)
          try {
            await restartService()
            const ready = await probe(settings.port)
            return send(res, 200, { saved: true, serverId: ready.identity.serverId, message: 'Configuração salva e serviço ativo.' })
          } catch (error) {
            writeConfigAtomic(configPath, previous)
            try { await restartService() } catch (rollbackError) {
              throw new Error(`Falhou a configuração. Arquivo anterior restaurado, mas o serviço precisa de verificação: ${rollbackError.message}`)
            }
            throw new Error(`A alteração foi revertida: ${error.message}`)
          }
        } finally { busy = false }
      }
      if (req.method === 'POST' && requestUrl.pathname === '/api/test') {
        const { publicUrl } = validateServerSettings(await readJson(req))
        const saved = parseServerEnvironment(fs.readFileSync(configPath, 'utf8'))
        const local = await probe(Number(saved.OBRA_NA_MAO_SERVER_PORT || 4732))
        const response = await fetch(`${publicUrl}/ready`, { signal: AbortSignal.timeout(8000), redirect: 'manual' })
        if (!response.ok) throw new Error(`HTTPS respondeu com status ${response.status}.`)
        const remote = await response.json()
        if (!remote?.ready || !remote?.identity?.serverId || remote.identity.serverId !== local.identity.serverId) throw new Error('O endereço HTTPS não corresponde a este servidor.')
        return send(res, 200, { connected: true, message: 'HTTPS válido, servidor identificado e pronto.' })
      }
      if (req.method === 'POST' && requestUrl.pathname === '/api/setup-code') {
        const env = parseServerEnvironment(fs.readFileSync(configPath, 'utf8'))
        await probe(Number(env.OBRA_NA_MAO_SERVER_PORT || 4732))
        return send(res, 200, issueSetupCode(configPath))
      }
      return send(res, 404, { error: 'Página não encontrada.' })
    } catch (error) { return send(res, 400, { error: error.message || 'Falha ao configurar.' }) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, LOOPBACK, resolve) })
  const url = `http://${LOOPBACK}:${server.address().port}/?token=${secret}`
  const idleTimeout = setTimeout(() => server.close(), 30 * 60 * 1000)
  idleTimeout.unref()
  if (openBrowser && process.platform === 'win32') {
    const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true })
    child.on('error', () => {})
    child.unref()
  }
  return { server, url, close: () => { clearTimeout(idleTimeout); return new Promise(resolve => server.close(resolve)) } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'win32' && typeof process.getuid === 'function' && process.getuid() !== 0) {
    console.error('Execute o configurador com sudo para gerenciar o serviço instalado.')
    process.exit(1)
  }
  startWizard({ openBrowser: process.argv.includes('--open') }).then(({ url }) => {
    console.log(`\nObra na Mão Server — Configuração local:\n${url}\n`)
    console.log('Em servidores Linux sem navegador, encaminhe a porta 4734 por SSH e abra o endereço acima no seu computador.')
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}