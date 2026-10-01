const { LocalSyncDataProvider, BRIDGE } = require('./sync-data-provider.cjs')

const PAUSE_REASONS = {
  'lan-client': 'A sincronização central é responsabilidade do PC principal.',
  remote: 'A sincronização por servidor remoto ainda não está disponível nesta etapa.'
}

function syncSourceQuery(scope = {}, modules = []) {
  const params = new URLSearchParams()
  const entries = {
    company_id: scope.companyId,
    obra_id: scope.workId,
    remote_company_id: scope.remoteCompanyId,
    remote_project_id: scope.remoteProjectId,
    device_id: scope.deviceId,
    work_name: scope.workName
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== null && String(value).length) params.set(key, String(value))
  }
  if (Array.isArray(modules) && modules.length) params.set('modules', modules.join(','))
  const value = params.toString()
  return value ? `?${value}` : ''
}

class LanSyncDataProvider {
  constructor({ lanClient }) {
    this.lanClient = lanClient
    this.capabilitiesCache = null
  }

  async capabilities() {
    const value = await this.lanClient.syncSourceCapabilities()
    this.capabilitiesCache = value
    return value
  }

  async requireBridge(entity) {
    if (!Object.hasOwn(BRIDGE, entity)) throw new Error('Entidade não disponível na bridge de sincronização.')
    const capabilities = await this.capabilities()
    if (!Array.isArray(capabilities?.bridgeEntities) || !capabilities.bridgeEntities.includes(entity)) {
      throw new Error('Fonte central ainda não suporta este módulo.')
    }
    return capabilities
  }

  async requireModule(module) {
    const capabilities = await this.capabilities()
    if (!Array.isArray(capabilities?.modules) || !capabilities.modules.includes(module)) {
      throw new Error('Fonte central ainda não suporta este módulo.')
    }
    return capabilities
  }

  async resolveScope({ companyId, workId }) {
    await this.requireModule('core')
    const [company, work] = await Promise.all([
      this.lanClient.get('empresas', Number(companyId)),
      this.lanClient.get('obras', Number(workId))
    ])
    if (!company || !work || Number(work.empresa_id) !== Number(companyId)) {
      throw new Error('Selecione uma obra pertencente à empresa central.')
    }
    return {
      companyId: Number(companyId),
      workId: Number(workId),
      companyName: company.razao_social || company.nome_fantasia || String(companyId),
      workName: work.nome
    }
  }

  async listBridge(entity, scope) {
    await this.requireBridge(entity)
    return this.lanClient.list(entity, { obra_id: scope.workId })
  }

  async getBridge(entity, localId, scope) {
    await this.requireBridge(entity)
    const row = await this.lanClient.get(entity, Number(localId))
    return row && Number(row.obra_id) === Number(scope.workId) ? row : null
  }

  async applyRemote(entity, localId, payload, scope) {
    await this.requireBridge(entity)
    if (payload?.deleted) throw new Error('Exclusão remota exige revisão manual no cadastro central.')
    const current = await this.getBridge(entity, localId, scope)
    if (!current) return false
    await this.lanClient.save(entity, { ...current, ...payload, id: Number(localId), obra_id: current.obra_id })
    return true
  }

  async summary(scope, modules = []) {
    await this.requireModule('summary')
    return this.lanClient.request('GET', `/api/v1/sync-source/summary${syncSourceQuery(scope, modules)}`)
  }

  async obligations(scope) {
    await this.requireModule('finance')
    return this.lanClient.request('GET', `/api/v1/sync-source/obligations${syncSourceQuery(scope)}`)
  }
}

class OperationalSyncDataProvider {
  constructor({ storage, localProvider, lanClient, database = null, now = Date.now }) {
    this.storage = storage
    this.localProvider = localProvider || (database ? new LocalSyncDataProvider({ database, now }) : null)
    this.lanProvider = new LanSyncDataProvider({ lanClient })
  }

  runtimeState() {
    const state = this.storage.state()
    const mode = state.operationalMode || (state.mode === 'server' ? 'lan-client' : 'local')
    if (mode === 'local') return { source: 'local', paused: false, pauseReason: null }
    if (mode === 'lan-host') return { source: 'lan-host', paused: false, pauseReason: null }
    return { source: mode, paused: true, pauseReason: PAUSE_REASONS[mode] || 'Sincronização pausada para esta fonte operacional.' }
  }

  activeProvider() {
    const runtime = this.runtimeState()
    if (runtime.paused) throw new Error(`Sincronização pausada: ${runtime.pauseReason}`)
    if (runtime.source === 'lan-host') return this.lanProvider
    if (!this.localProvider) throw new Error('Fonte local de sincronização indisponível.')
    return this.localProvider
  }

  async syncCapabilities() {
    const runtime = this.runtimeState()
    if (runtime.paused) throw new Error(`Sincronização pausada: ${runtime.pauseReason}`)
    if (runtime.source !== 'lan-host') return null
    return this.lanProvider.capabilities()
  }

  async resolveScope(input) { return this.activeProvider().resolveScope(input) }
  async listBridge(entity, scope) { return this.activeProvider().listBridge(entity, scope) }
  async getBridge(entity, localId, scope) { return this.activeProvider().getBridge(entity, localId, scope) }
  async summary(scope, modules) { return this.activeProvider().summary(scope, modules) }
  async obligations(scope) { return this.activeProvider().obligations(scope) }
  async applyRemote(entity, localId, payload, scope) { return this.activeProvider().applyRemote(entity, localId, payload, scope) }
}

module.exports = { LanSyncDataProvider, OperationalSyncDataProvider }
