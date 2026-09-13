const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const DEFAULT_BASE_URL = process.env.OBRA_NA_MAO_PLATFORM_URL || process.env.FLUXO_DRE_PLATFORM_URL || 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev'
const CONFIG_FILE = 'online-connection.json'

class OnlineService {
  constructor({ dataDir, shell, safeStorage, fetchImpl = global.fetch, baseUrl = DEFAULT_BASE_URL }) {
    this.dataDir = dataDir
    this.shell = shell
    this.safeStorage = safeStorage
    this.fetchImpl = fetchImpl
    this.configPath = path.join(dataDir, CONFIG_FILE)
    fs.mkdirSync(dataDir, { recursive: true })
    const saved = this.readConfig().baseUrl
    this.baseUrl = String(saved || baseUrl || DEFAULT_BASE_URL).trim().replace(/\/$/, '')
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

  setBaseUrl(value) {
    this.passwordSession = null
    const next = String(value || '').trim().replace(/\/$/, '')
    if (!/^https?:\/\//i.test(next)) throw new Error('Informe uma URL online válida, começando por https://.')
    const current = this.readConfig()
    const changed = this.baseUrl && this.baseUrl !== next
    this.baseUrl = next
    if (changed) {
      delete current.tokenValue
      delete current.tokenEncoding
      delete current.linkedAt
      delete current.pending
    }
    fs.writeFileSync(this.configPath, JSON.stringify({ ...current, baseUrl: next, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
    return this.state()
  }

  async request(route, payload, timeoutMs = 15000, auth = null) {
    if (!this.baseUrl) throw new Error('Configure o endereço online do Obra na Mão em Configurações.')
    if (typeof this.fetchImpl !== 'function') throw new Error('Este ambiente não possui suporte HTTP.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await this.fetchImpl(this.baseUrl + route, {
        method: payload === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', ...(auth?.cookie ? { cookie: auth.cookie } : {}) },
        body: payload === undefined ? undefined : JSON.stringify(payload || {}),
        redirect: 'error',
        signal: controller.signal
      })
      let data = {}
      try { data = await response.json() } catch {}
      if (!response.ok) throw new Error(data.error || data.message || `Falha online (HTTP ${response.status}).`)
      if (auth) {
        const cookies = response.headers?.getSetCookie?.() || [response.headers?.get?.('set-cookie') || '']
        const session = cookies.join('; ').match(/(?:^|[;,]\s*)obn_session=([^; ,]+)/)
        if (session) auth.cookie = `obn_session=${session[1]}`
      }
      return data
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`A conexão online excedeu ${Math.round(timeoutMs / 1000)} segundos.`)
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async passwordAuth({ email, password, code, firstAccess = false } = {}) {
    if (!this.baseUrl.startsWith('https://')) throw new Error('O acesso por senha exige uma conexão HTTPS segura.')
    if (this.passwordBusy) throw new Error('Aguarde a autenticação em andamento.')
    this.passwordBusy = true
    this.passwordSession = null
    try {
      const auth = {}
      await this.request(`/api/auth/password/${firstAccess ? 'first-access' : 'login'}`, {
        email: String(email || '').trim().toLowerCase(), password: String(password || ''),
        ...(firstAccess ? { code: String(code || '').trim().toUpperCase() } : {})
      }, 15000, auth)
      if (!auth.cookie) throw new Error('O servidor não retornou uma sessão de autenticação válida.')
      this.passwordSession = { ...auth, baseUrl: this.baseUrl }
      return await this.completePasswordLink()
    } finally { this.passwordBusy = false }
  }

  async completePasswordLink(setup) {
    const auth = this.passwordSession
    if (!auth || auth.baseUrl !== this.baseUrl) throw new Error('Entre novamente para continuar a configuração.')
    if (setup) await this.request('/api/desktop/claim', { companyName: String(setup.companyName || '').trim(), projectName: String(setup.projectName || '').trim() }, 15000, auth)
    const bootstrap = await this.request('/api/desktop/bootstrap', undefined, 15000, auth)
    if (bootstrap.needsClaim) {
      if (!bootstrap.authorized) throw new Error('Sua licença não permite acesso ao Desktop.')
      return { linked: false, needsSetup: true }
    }
    if (!bootstrap.company?.id) throw new Error('A conta não possui uma empresa vinculada.')
    this.assertTenant(bootstrap.company.id)
    const requestId = crypto.randomBytes(18).toString('hex'), secret = crypto.randomBytes(24).toString('hex')
    await this.request('/api/desktop/start', { requestId, secret, installationId: this.installationId(), deviceName: os.hostname() || 'Computador', platform: process.platform })
    await this.request('/api/desktop/approve', { requestId, secret }, 15000, auth)
    const result = await this.request('/api/desktop/status', { requestId, secret })
    if (result.status !== 'approved' || !result.deviceToken) throw new Error('Não foi possível concluir o vínculo deste computador.')
    const session = await this.request('/api/desktop/session', { deviceToken: result.deviceToken })
    if (!session.authorized || String(session.company?.id) !== String(bootstrap.company.id)) throw new Error('A empresa da sessão não corresponde à conta autenticada.')
    this.assertTenant(session.company.id)
    this.writeConfig({ tenant: { companyId: String(session.company.id), companyName: session.company.name || '', baseUrl: this.baseUrl } })
    this.storeToken(result.deviceToken)
    this.passwordSession = null
    return { linked: true, needsSetup: false, company: session.company, project: session.project }
  }

  assertTenant(companyId) {
    const tenant = this.readConfig().tenant
    if (tenant && (tenant.companyId !== String(companyId) || tenant.baseUrl !== this.baseUrl)) throw new Error('Este perfil local pertence a outra empresa. Use um perfil Windows separado para acessar outra empresa sem misturar os dados.')
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
      const session = await this.request('/api/desktop/session', { deviceToken: result.deviceToken })
      if (!session.authorized || !session.company?.id) throw new Error('Conclua o vínculo da sua empresa antes de autorizar este computador.')
      this.assertTenant(session.company.id)
      this.writeConfig({ tenant: { companyId: String(session.company.id), companyName: session.company.name || '', baseUrl: this.baseUrl } })
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
    this.passwordSession = null
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
    return this.request('/api/desktop/ai/analyze', { deviceToken: this.requireToken(), ...input }, 90000)
  }

  async conflicts() {
    return this.request('/api/desktop/sync/conflicts', { deviceToken: this.requireToken() })
  }

  async resolveConflict(conflictId, resolution) {
    return this.request('/api/desktop/sync/conflicts/resolve', { deviceToken: this.requireToken(), conflictId, resolution })
  }
}

module.exports = { OnlineService, DEFAULT_BASE_URL }
