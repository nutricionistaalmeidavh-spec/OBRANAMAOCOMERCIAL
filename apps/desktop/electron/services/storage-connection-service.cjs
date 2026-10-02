const { parseServerAddress } = require('./server-endpoint.cjs')

const MODES = new Set(['local', 'server'])
const OPERATIONAL_MODES = new Set(['local', 'lan-host', 'lan-client', 'remote'])
const SCHEMES = new Set(['http', 'https'])
const MODE_KEY = 'storage_mode'
const OPERATIONAL_MODE_KEY = 'storage_operational_mode'
const SCHEME_KEY = 'lan_server_scheme'
const HOST_KEY = 'lan_server_host'
const PORT_KEY = 'lan_server_port'
const DEFAULT_SCHEME = 'http'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4732

function legacyToOperational(mode) {
  return mode === 'server' ? 'lan-client' : 'local'
}

function operationalToLegacy(operationalMode) {
  return operationalMode === 'local' ? 'local' : 'server'
}

function buildBaseUrl({ scheme, host, port }) {
  const formattedHost = String(host).includes(':') ? `[${host}]` : host
  const url = new URL(`${scheme}://${formattedHost}:${port}`)
  return url.origin
}

class StorageConnectionService {
  constructor({ db, fetchImpl = globalThis.fetch, timeoutMs = 3000 }) {
    this.db = db
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  read(key) {
    return this.db.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(key)?.valor
  }

  write(key, value) {
    this.db.db.prepare('INSERT INTO configuracoes(chave,valor,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP').run(key, String(value))
  }

  validateMode(mode) {
    if (!MODES.has(mode)) throw new Error('Modo de armazenamento inválido.')
    return mode
  }

  validateOperationalMode(mode) {
    if (!OPERATIONAL_MODES.has(mode)) throw new Error('Papel operacional de armazenamento inválido.')
    return mode
  }

  validateScheme(scheme) {
    const value = String(scheme || DEFAULT_SCHEME).toLowerCase()
    if (!SCHEMES.has(value)) throw new Error('Protocolo do servidor inválido.')
    return value
  }

  validateHost(host) {
    const value = String(host ?? '').trim()
    if (!value || /[/@\\?#\s]/.test(value) || !/^[A-Za-z0-9.:-]+$/.test(value)) {
      throw new Error('Endereço do servidor inválido. Informe somente o host ou IP, sem protocolo ou caminho.')
    }
    return value
  }

  validatePort(port) {
    const value = Number(port)
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('Porta do servidor inválida.')
    return value
  }

  state() {
    const savedMode = this.read(MODE_KEY)
    const mode = MODES.has(savedMode) ? savedMode : 'local'
    const savedOperationalMode = this.read(OPERATIONAL_MODE_KEY)
    const operationalMode = OPERATIONAL_MODES.has(savedOperationalMode) ? savedOperationalMode : legacyToOperational(mode)

    let scheme = DEFAULT_SCHEME
    const savedScheme = this.read(SCHEME_KEY)
    if (savedScheme) {
      try { scheme = this.validateScheme(savedScheme) } catch { scheme = DEFAULT_SCHEME }
    }

    let host = DEFAULT_HOST
    const savedHost = this.read(HOST_KEY)
    if (savedHost) {
      try { host = this.validateHost(savedHost) } catch { host = DEFAULT_HOST }
    }

    let port = scheme === 'https' ? 443 : DEFAULT_PORT
    const savedPort = this.read(PORT_KEY)
    if (savedPort !== undefined) {
      const parsed = Number(savedPort)
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) port = parsed
    }

    return { mode, operationalMode, scheme, host, port, baseUrl: buildBaseUrl({ scheme, host, port }) }
  }

  configure({ mode, operationalMode, scheme, host, port, address } = {}) {
    let validOperationalMode
    let validMode
    if (operationalMode !== undefined) {
      validOperationalMode = this.validateOperationalMode(operationalMode)
      validMode = operationalToLegacy(validOperationalMode)
      if (mode !== undefined && this.validateMode(mode) !== validMode) {
        throw new Error('Modo legado não corresponde ao papel operacional informado.')
      }
    } else {
      validMode = this.validateMode(mode)
      validOperationalMode = legacyToOperational(validMode)
    }

    let endpoint
    if (address !== undefined) {
      endpoint = parseServerAddress(address)
    } else {
      const validScheme = this.validateScheme(scheme || DEFAULT_SCHEME)
      const requiresExplicitHost = validOperationalMode === 'lan-client' || validOperationalMode === 'remote'
      const hostCandidate = requiresExplicitHost ? host : (host || DEFAULT_HOST)
      const validHost = this.validateHost(hostCandidate)
      const validPort = this.validatePort(port ?? (validScheme === 'https' ? 443 : DEFAULT_PORT))
      endpoint = { scheme: validScheme, host: validHost, port: validPort }
    }

    this.write(MODE_KEY, validMode)
    this.write(OPERATIONAL_MODE_KEY, validOperationalMode)
    this.write(SCHEME_KEY, endpoint.scheme)
    this.write(HOST_KEY, endpoint.host)
    this.write(PORT_KEY, endpoint.port)
    return this.state()
  }

  async probeEndpoint(endpoint) {
    const baseUrl = buildBaseUrl(endpoint)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const startedAt = Date.now()
    try {
      const options = {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      }
      const [healthResponse, readyResponse] = await Promise.all([
        this.fetchImpl(`${baseUrl}/health`, options),
        this.fetchImpl(`${baseUrl}/ready`, options)
      ])

      if (!healthResponse?.ok) throw new Error(`Servidor respondeu HTTP ${healthResponse?.status ?? 'inválido'} no health check.`)
      const health = await healthResponse.json()
      if (health?.status !== 'ok' || health?.product !== 'Obra na Mão' || String(health?.apiVersion) !== '1') {
        throw new Error('O endereço respondeu, mas não é um servidor Obra na Mão compatível.')
      }

      const readiness = typeof readyResponse?.json === 'function' ? await readyResponse.json() : null
      if (!readyResponse?.ok || readiness?.ready !== true) {
        throw new Error('O servidor Obra na Mão foi encontrado, mas ainda não está pronto para conexão.')
      }

      return {
        ok: true,
        baseUrl,
        latencyMs: Math.max(0, Date.now() - startedAt),
        health,
        readiness,
        serverId: readiness?.identity?.serverId || null
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Tempo esgotado ao conectar ao servidor da empresa.')
      const message = error instanceof Error ? error.message : String(error)
      if (/Servidor respondeu HTTP|não é um servidor Obra na Mão compatível|ainda não está pronto/.test(message)) throw error
      throw new Error('Não foi possível conectar ao servidor da empresa.')
    } finally {
      clearTimeout(timer)
    }
  }

  async probeAddress(address) {
    return this.probeEndpoint(parseServerAddress(address))
  }

  async connectAddress(address) {
    const endpoint = parseServerAddress(address)
    const server = await this.probeEndpoint(endpoint)
    const state = this.configure({
      operationalMode: 'lan-client',
      scheme: endpoint.scheme,
      host: endpoint.host,
      port: endpoint.port
    })
    return { state, server }
  }

  async testConnection() {
    const state = this.state()
    if (state.mode !== 'server') throw new Error('Selecione Servidor da empresa antes de testar a conexão.')
    return this.probeEndpoint(state)
  }
}

module.exports = { StorageConnectionService, legacyToOperational, operationalToLegacy }
