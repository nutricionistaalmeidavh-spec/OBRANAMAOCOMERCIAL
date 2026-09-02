const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const DEFAULT_BASE_URL = process.env.FLUXO_DRE_PLATFORM_URL || 'https://fluxodre-campo-b2u-clbfo5.v2.appdeploy.ai'
const CONFIG_FILE = 'online-connection.json'

class OnlineService {
  constructor({ dataDir, shell, safeStorage, fetchImpl = global.fetch, baseUrl = DEFAULT_BASE_URL }) {
    this.dataDir = dataDir
    this.shell = shell
    this.safeStorage = safeStorage
    this.fetchImpl = fetchImpl
    this.baseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
    this.configPath = path.join(dataDir, CONFIG_FILE)
    fs.mkdirSync(dataDir, { recursive: true })
  }

  readConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
    } catch {
      return {}
    }
  }

  writeConfig(next) {
    const current = this.readConfig()
    const merged = { ...current, ...next, updatedAt: new Date().toISOString() }
    fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2), { mode: 0o600 })
    return merged
  }

  installationId() {
    const current = this.readConfig()
    if (current.installationId) return current.installationId
    const installationId = crypto.randomUUID().replace(/-/g, '')
    this.writeConfig({ installationId })
    return installationId
  }

  storeToken(token) {
    let tokenValue = ''
    let tokenEncoding = 'base64'
    if (this.safeStorage?.isEncryptionAvailable?.()) {
      tokenValue = this.safeStorage.encryptString(token).toString('base64')
      tokenEncoding = 'safeStorage'
    } else {
      tokenValue = Buffer.from(token, 'utf8').toString('base64')
    }
    this.writeConfig({ tokenValue, tokenEncoding, linkedAt: new Date().toISOString(), pending: null })
  }

  deviceToken() {
    const cfg = this.readConfig()
    if (!cfg.tokenValue) return ''
    try {
      const data = Buffer.from(cfg.tokenValue, 'base64')
      if (cfg.tokenEncoding === 'safeStorage' && this.safeStorage?.isEncryptionAvailable?.()) {
        return this.safeStorage.decryptString(data)
      }
      return data.toString('utf8')
    } catch {
      return ''
    }
  }

  state() {
    const cfg = this.readConfig()
    return {
      baseUrl: this.baseUrl,
      installationId: this.installationId(),
      linked: !!this.deviceToken(),
      linkedAt: cfg.linkedAt || null,
      pending: cfg.pending ? { expiresAt: cfg.pending.expiresAt || null } : null
    }
  }

  async request(route, payload) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Este ambiente não possui suporte HTTP.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await this.fetchImpl(this.baseUrl + route, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal: controller.signal
      })
      let data = {}
      try { data = await response.json() } catch {}
      if (!response.ok) throw new Error(data.error || data.message || `Falha online (HTTP ${response.status}).`)
      return data
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('A conexão online excedeu 15 segundos.')
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async start({ activationCode = '' } = {}) {
    const requestId = crypto.randomBytes(18).toString('hex')
    const secret = crypto.randomBytes(24).toString('hex')
    const installationId = this.installationId()
    const result = await this.request('/api/desktop/start', {
      requestId,
      secret,
      installationId,
      deviceName: os.hostname() || 'Computador',
      platform: process.platform,
      activationCode: String(activationCode || '').trim().toUpperCase() || undefined
    })
    const pending = { requestId, secret, expiresAt: result.expiresAt }
    this.writeConfig({ pending })
    const approvalUrl = `${this.baseUrl}/#desktop-auth=${requestId}.${secret}`
    if (this.shell?.openExternal) await this.shell.openExternal(approvalUrl)
    return { approvalUrl, expiresAt: result.expiresAt }
  }

  async status() {
    const cfg = this.readConfig()
    if (!cfg.pending?.requestId || !cfg.pending?.secret) {
      if (this.deviceToken()) return { status: 'approved', linked: true }
      return { status: 'idle', linked: false }
    }
    const result = await this.request('/api/desktop/status', {
      requestId: cfg.pending.requestId,
      secret: cfg.pending.secret
    })
    if (result.status === 'approved' && result.deviceToken) {
      this.storeToken(result.deviceToken)
      return { status: 'approved', linked: true, deviceId: result.deviceId }
    }
    return { status: 'pending', linked: false, expiresAt: result.expiresAt || cfg.pending.expiresAt }
  }

  requireToken() {
    const token = this.deviceToken()
    if (!token) throw new Error('Este Desktop ainda não foi vinculado ao Obra na Mão online.')
    return token
  }

  async session() {
    return this.request('/api/desktop/session', { deviceToken: this.requireToken() })
  }

  disconnect() {
    const cfg = this.readConfig()
    delete cfg.tokenValue
    delete cfg.tokenEncoding
    delete cfg.linkedAt
    delete cfg.pending
    fs.writeFileSync(this.configPath, JSON.stringify({ ...cfg, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
    return this.state()
  }

  async syncPull(sinceRevision = 0) {
    return this.request('/api/desktop/sync/pull', { deviceToken: this.requireToken(), sinceRevision })
  }

  async syncPush(changes = []) {
    return this.request('/api/desktop/sync/push', { deviceToken: this.requireToken(), changes })
  }

  async publishMobileSummary(summary) {
    return this.request('/api/desktop/mobile-summary/publish', { deviceToken: this.requireToken(), summary })
  }

  async financeRead(view) {
    return this.request('/api/desktop/finance/read', { deviceToken: this.requireToken(), view })
  }

  async financeWrite(action, input) {
    return this.request('/api/desktop/finance/write', { deviceToken: this.requireToken(), action, input })
  }

  async publishFinanceReference(obligations) {
    return this.request('/api/desktop/finance-reference/publish', { deviceToken: this.requireToken(), obligations })
  }

  async aiAnalyze(input) {
    return this.request('/api/desktop/ai/analyze', { deviceToken: this.requireToken(), ...input })
  }

  async conflicts() {
    return this.request('/api/desktop/sync/conflicts', { deviceToken: this.requireToken() })
  }

  async resolveConflict(conflictId, resolution) {
    return this.request('/api/desktop/sync/conflicts/resolve', { deviceToken: this.requireToken(), conflictId, resolution })
  }
}

module.exports = { OnlineService, DEFAULT_BASE_URL }
