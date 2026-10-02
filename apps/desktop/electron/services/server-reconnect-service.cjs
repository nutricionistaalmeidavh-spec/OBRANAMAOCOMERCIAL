const TERMINAL_AUTH_ERRORS = new Set(['invalid_device_token','device_revoked','member_not_authorized','desktop_channel_required'])

class ServerReconnectService {
  constructor({ storage, discovery, credentials, fetchImpl = globalThis.fetch, timeoutMs = 3000 } = {}) {
    if (!storage || !discovery || !credentials) throw new Error('Dependências de reconexão LAN incompletas.')
    this.storage = storage
    this.discovery = discovery
    this.credentials = credentials
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  async authenticatedSession(state, serverId) {
    const token = this.credentials.token(serverId)
    if (!token) return { ok:false, terminal:true, reason:'missing_credential' }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(`${state.baseUrl}/api/v1/session`, {
        method:'GET',
        headers:{ Accept:'application/json', Authorization:`Bearer ${token}` },
        signal:controller.signal
      })
      let payload={}
      try { payload=await response.json() } catch {}
      if (!response?.ok) {
        const reason=String(payload?.error || `http_${response?.status ?? 'invalid'}`)
        if (TERMINAL_AUTH_ERRORS.has(reason)) {
          this.credentials.clear(serverId)
          return { ok:false, terminal:true, reason }
        }
        return { ok:false, terminal:false, reason }
      }
      if (String(payload?.serverId || '') !== String(serverId)) {
        return { ok:false, terminal:false, reason:'server_identity_mismatch' }
      }
      return { ok:true, payload }
    } catch (error) {
      return { ok:false, terminal:false, reason:error?.name==='AbortError'?'timeout':'network_unavailable' }
    } finally {
      clearTimeout(timer)
    }
  }

  async resolveIdentity(state) {
    const selectedId=String(state.serverId || '').trim()
    try {
      const probe=await this.storage.probeAddress(state.baseUrl)
      const probedId=String(probe?.serverId || '').trim()
      if (!probedId) return { status:'unreachable', serverId:selectedId || null, reason:'identity_missing' }
      if (selectedId && probedId !== selectedId) return { status:'rediscover', serverId:selectedId, reason:'identity_mismatch' }

      const serverId=selectedId || probedId
      if (!selectedId) this.storage.bindServerIdentity?.(serverId)
      this.credentials.rekey?.(state.baseUrl,serverId)
      return { status:'ready', serverId, state:this.storage.state() }
    } catch {
      return { status:'rediscover', serverId:selectedId || null, reason:'endpoint_unreachable' }
    }
  }

  async reconnect() {
    let state=this.storage.state()
    if (state.operationalMode !== 'lan-client' && state.operationalMode !== 'remote') {
      return { status:'not-applicable', serverId:state.serverId || null, endpointChanged:false, reusedCredential:false }
    }

    let identity=await this.resolveIdentity(state)
    let endpointChanged=false

    if (identity.status === 'rediscover') {
      const selectedId=String(identity.serverId || '').trim()
      if (!selectedId) return { status:'unreachable', serverId:null, reason:'identity_unknown', endpointChanged:false, reusedCredential:false }
      let found=[]
      try { found=await this.discovery.discover() } catch {}
      const same=Array.isArray(found) ? found.find(item=>String(item?.serverId || '')===selectedId) : null
      if (!same?.baseUrl) return { status:'unreachable', serverId:selectedId, reason:identity.reason, endpointChanged:false, reusedCredential:false }

      this.storage.updateEndpointForServer(selectedId,same.baseUrl)
      endpointChanged=true
      state=this.storage.state()

      try {
        const verified=await this.storage.probeAddress(state.baseUrl)
        if (String(verified?.serverId || '') !== selectedId) {
          return { status:'unreachable', serverId:selectedId, reason:'identity_mismatch', endpointChanged:false, reusedCredential:false }
        }
      } catch {
        return { status:'unreachable', serverId:selectedId, reason:'endpoint_unreachable', endpointChanged:false, reusedCredential:false }
      }
      identity={status:'ready',serverId:selectedId,state}
    }

    if (identity.status !== 'ready') {
      return { status:'unreachable', serverId:identity.serverId || null, reason:identity.reason, endpointChanged:false, reusedCredential:false }
    }

    state=identity.state || this.storage.state()
    const serverId=identity.serverId
    this.credentials.rekey?.(state.baseUrl,serverId)

    const session=await this.authenticatedSession(state,serverId)
    if (!session.ok) {
      if (session.terminal) return { status:'pairing-required', serverId, reason:session.reason, endpointChanged, reusedCredential:false }
      return { status:'unreachable', serverId, reason:session.reason, endpointChanged, reusedCredential:false }
    }

    return {
      status:'connected',
      serverId,
      endpointChanged,
      reusedCredential:true,
      baseUrl:state.baseUrl,
      device:session.payload?.device || null,
      member:session.payload?.member || null
    }
  }
}

module.exports={ServerReconnectService}
