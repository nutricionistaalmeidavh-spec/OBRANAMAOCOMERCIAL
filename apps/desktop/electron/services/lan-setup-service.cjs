const os = require('node:os')

const TERMINAL_AUTH_ERRORS = new Set(['invalid_device_token','device_revoked','member_not_authorized','desktop_channel_required'])

class LanSetupService {
  constructor({ storage, credentials, online, fetchImpl = globalThis.fetch, deviceName = os.hostname() || 'Computador', timeoutMs = 10000, setupCodeProvider = null }) {
    if (!storage || !credentials || !online) throw new Error('Dependências de configuração LAN incompletas.')
    this.storage = storage
    this.credentials = credentials
    this.online = online
    this.fetchImpl = fetchImpl
    this.deviceName = String(deviceName || 'Computador')
    this.timeoutMs = timeoutMs
    this.setupCodeProvider = setupCodeProvider
  }

  connection() {
    const state = this.storage.state()
    if (state.operationalMode === 'local' || !state.baseUrl) throw new Error('Nenhum servidor LAN está selecionado.')
    return { ...state, serverKey: String(state.serverId || state.serverKey || state.baseUrl) }
  }

  async request(path, { method = 'GET', body, authenticated = false } = {}) {
    const state = this.connection()
    const headers = { Accept: 'application/json' }
    let token = ''
    if (authenticated) {
      token = this.credentials.token(state.serverKey)
      if (!token) throw new Error('Este computador ainda não está pareado neste servidor.')
      headers.Authorization = `Bearer ${token}`
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(`${state.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      })
      let payload = {}
      try { payload = await response.json() } catch {}
      if (!response?.ok) {
        if (authenticated && TERMINAL_AUTH_ERRORS.has(String(payload?.error || ''))) this.credentials.clear?.(state.serverKey)
        const raw = String(payload?.message || payload?.error || `Servidor LAN respondeu HTTP ${response?.status ?? 'inválido'}.`)
        const message = token ? raw.split(token).join('[credencial protegida]') : raw
        throw new Error(message)
      }
      return payload
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Tempo esgotado ao acessar o servidor LAN.')
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  reconcileIdentity(setup, connection = this.connection()) {
    const serverId = String(setup?.serverId || '').trim()
    if (!serverId) throw new Error('Servidor LAN não informou uma identidade válida.')
    if (connection.serverId && String(connection.serverId) !== serverId) {
      throw new Error('A identidade do servidor encontrado não corresponde à instância selecionada.')
    }
    if (!connection.serverId && typeof this.storage.bindServerIdentity === 'function') this.storage.bindServerIdentity(serverId)
    this.credentials.rekey?.(connection.baseUrl, serverId)
    const current = this.storage.state()
    return { ...current, serverId, serverKey: serverId }
  }

  async status() {
    const connection = this.connection()
    const setup = await this.request('/api/v1/setup/status')
    const state = this.reconcileIdentity(setup, connection)
    return {
      serverKey: state.serverKey,
      baseUrl: state.baseUrl,
      serverId: state.serverId,
      claimed: !!setup.claimed,
      credential: this.credentials.state(state.serverKey)
    }
  }

  async startCloudClaim(serverId) {
    if (typeof this.online.startLanServerClaim === 'function') return this.online.startLanServerClaim(serverId)
    const deviceToken = this.online.deviceToken?.()
    if (!deviceToken || typeof this.online.request !== 'function') throw new Error('A conta online precisa estar vinculada antes de configurar o servidor LAN.')
    const result = await this.online.request('/api/desktop/lan/claim/start', { deviceToken, serverId })
    return { claimToken: result.claimToken, expiresAt: result.expiresAt }
  }

  resolveSetupCode(explicitCode) {
    const explicit = String(explicitCode || '').trim().toUpperCase()
    if (explicit) return explicit
    const internal = typeof this.setupCodeProvider === 'function' ? String(this.setupCodeProvider() || '').trim().toUpperCase() : ''
    if (!internal) throw new Error('Código de configuração do servidor ainda não está disponível.')
    return internal
  }

  async claimHostedServer({ setupCode } = {}) {
    const initialConnection = this.connection()
    const setup = await this.request('/api/v1/setup/status')
    const connection = this.reconcileIdentity(setup, initialConnection)
    if (setup.claimed) throw new Error('Este servidor LAN já foi configurado.')
    if (!setup.serverId) throw new Error('Servidor LAN não informou uma identidade válida.')
    const session = await this.online.session()
    if (session?.role !== 'admin' && session?.platformRole !== 'superadmin') throw new Error('Somente um Administrador da empresa pode reivindicar o servidor LAN.')
    const claim = await this.startCloudClaim(setup.serverId)
    if (!claim?.claimToken) throw new Error('Não foi possível obter autorização Cloud para o servidor LAN.')
    const result = await this.request('/api/v1/setup/claim', {
      method: 'POST',
      body: {
        setupCode: this.resolveSetupCode(setupCode),
        claimToken: claim.claimToken,
        installationId: this.online.installationId(),
        deviceName: this.deviceName
      }
    })
    if (!result?.deviceToken || !result?.device?.id) throw new Error('Servidor LAN não retornou a credencial inicial do computador.')
    const member = result.device.member || null
    const resolvedServerId = String(result.serverId || setup.serverId || '').trim()
    if (resolvedServerId !== connection.serverId) throw new Error('A identidade retornada pelo servidor mudou durante a configuração.')
    const credential = this.credentials.store({ serverKey: connection.serverId, deviceId: result.device.id, member, token: result.deviceToken })
    return {
      serverKey: connection.serverId,
      baseUrl: connection.baseUrl,
      serverId: connection.serverId,
      claimed: true,
      company: result.company || null,
      credential
    }
  }

  async pair({ code } = {}) {
    const initialConnection = this.connection()
    const setup = await this.request('/api/v1/setup/status')
    if (!setup?.claimed) throw new Error('O servidor ainda não foi configurado para aceitar pareamento.')
    const connection = this.reconcileIdentity(setup, initialConnection)
    const result = await this.request('/api/v1/pair/claim', {
      method: 'POST',
      body: {
        code: String(code || '').trim().toUpperCase(),
        installationId: this.online.installationId(),
        deviceName: this.deviceName
      }
    })
    if (!result?.deviceToken || !result?.device?.id) throw new Error('Pareamento LAN não retornou uma credencial válida.')
    const credential = this.credentials.store({ serverKey: connection.serverId, deviceId: result.device.id, member: result.member || null, token: result.deviceToken })
    return { serverKey: connection.serverId, baseUrl: connection.baseUrl, serverId: connection.serverId, paired: true, credential }
  }

  disconnect() {
    const state = this.connection()
    return this.credentials.clear(state.serverKey)
  }

  async adminStatus() {
    return this.request('/api/v1/admin/status', { authenticated: true })
  }

  async createPairing({ memberId } = {}) {
    return this.request('/api/v1/admin/pairing', { method: 'POST', authenticated: true, body: { targetMemberId: memberId } })
  }

  async listDevices() {
    return this.request('/api/v1/admin/devices', { authenticated: true })
  }

  async setDeviceStatus({ deviceId, status } = {}) {
    return this.request(`/api/v1/admin/devices/${encodeURIComponent(String(deviceId || ''))}`, { method: 'PUT', authenticated: true, body: { status } })
  }

  async refreshIdentity() {
    return this.request('/api/v1/admin/identity/refresh', { method: 'POST', authenticated: true })
  }
}

module.exports = { LanSetupService }
