const MODES = new Set(['local', 'server'])
const OPERATIONAL_MODES = new Set(['local', 'lan-host', 'lan-client', 'remote'])
const MODE_KEY = 'storage_mode'
const HOST_KEY = 'lan_server_host'
const PORT_KEY = 'lan_server_port'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4732

function legacyToOperational(mode) {
  return mode === 'server' ? 'lan-client' : 'local'
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

  validateHost(host) {
    const value = String(host ?? '').trim()
    if (!value || /[:/@\\?#]/.test(value) || !/^[A-Za-z0-9.-]+$/.test(value)) {
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
    const operationalMode = legacyToOperational(mode)

    let host = DEFAULT_HOST
    const savedHost = this.read(HOST_KEY)
    if (savedHost) {
      try { host = this.validateHost(savedHost) } catch { host = DEFAULT_HOST }
    }

    let port = DEFAULT_PORT
    const savedPort = this.read(PORT_KEY)
    if (savedPort !== undefined) {
      const parsed = Number(savedPort)
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) port = parsed
    }

    return { mode, operationalMode, host, port, baseUrl: `http://${host}:${port}` }
  }

  configure({ mode, host, port }) {
    const validMode = this.validateMode(mode)
    const validHost = this.validateHost(host || DEFAULT_HOST)
    const validPort = this.validatePort(port ?? DEFAULT_PORT)
    this.write(MODE_KEY, validMode)
    this.write(HOST_KEY, validHost)
    this.write(PORT_KEY, validPort)
    return this.state()
  }

  async testConnection() {
    const state = this.state()
    if (state.mode !== 'server') throw new Error('Selecione Servidor da empresa antes de testar a conexão.')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const startedAt = Date.now()

    try {
      const response = await this.fetchImpl(`${state.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      })
      if (!response?.ok) throw new Error(`Servidor respondeu HTTP ${response?.status ?? 'inválido'}.`)
      const health = await response.json()
      if (health?.status !== 'ok' || health?.product !== 'Obra na Mão' || String(health?.apiVersion) !== '1') {
        throw new Error('O endereço respondeu, mas não é um servidor Obra na Mão compatível.')
      }
      return {
        ok: true,
        baseUrl: state.baseUrl,
        latencyMs: Math.max(0, Date.now() - startedAt),
        health
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Tempo esgotado ao conectar ao servidor da empresa.')
      const message = error instanceof Error ? error.message : String(error)
      if (/Servidor respondeu HTTP|não é um servidor Obra na Mão compatível/.test(message)) throw error
      throw new Error('Não foi possível conectar ao servidor da empresa.')
    } finally {
      clearTimeout(timer)
    }
  }
}

module.exports = { StorageConnectionService, legacyToOperational }
