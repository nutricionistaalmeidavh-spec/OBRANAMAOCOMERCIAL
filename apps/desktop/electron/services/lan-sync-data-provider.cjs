const { LocalSyncDataProvider, BRIDGE, EDITABLE } = require('./sync-data-provider.cjs')

const PAUSE_REASONS = {
  'lan-client': 'A sincronização central é responsabilidade do PC principal.'
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
    if(['pedido_compra_itens','medicao_itens','contrato_aditivos','recebimentos_materiais'].includes(entity))
      return this.lanClient.request('GET','/api/v1/sync-source/p1-children',{query:{
        entity,obra_id:scope.workId,company_id:scope.companyId,remote_company_id:scope.remoteCompanyId
      }}).then(result=>result.items||[])
    if(entity==='empresas')return [await this.lanClient.get('empresas',scope.companyId)]
    return this.lanClient.list(entity, ['clientes','obras'].includes(entity)?{empresa_id:scope.companyId}:{obra_id:scope.workId})
  }

  async getBridge(entity, localId, scope) {
    await this.requireBridge(entity)
    const childParents={pedido_compra_itens:['pedidos_compra','pedido_compra_id'],medicao_itens:['medicoes','medicao_id'],
      contrato_aditivos:['contratos_obra','contrato_id'],recebimentos_materiais:['pedidos_compra','pedido_compra_id']}
    if(Object.hasOwn(childParents,entity)){
      const row=await this.lanClient.get(entity,Number(localId))
      if(!row)return null
      const [parent,key]=childParents[entity],source=await this.lanClient.get(parent,Number(row[key]))
      return source&&!source.deleted_at&&Number(source.obra_id)===Number(scope.workId)?row:null
    }
    const row = await this.lanClient.get(entity, Number(localId))
    return row && (entity==='empresas'?Number(row.id)===Number(scope.companyId):['clientes','obras'].includes(entity)?Number(row.empresa_id)===Number(scope.companyId):Number(row.obra_id)===Number(scope.workId))?row:null
  }

  async applyWebP0Create(scope,command) {
    const capabilities=await this.capabilities()
    if(!Array.isArray(capabilities?.features)||!capabilities.features.includes('web-p0-idempotent-commands-v1'))
      throw new Error('Atualize o servidor próprio para receber cadastros Web com idempotência.')
    return this.lanClient.request('POST','/api/v1/web-p0/commands',{body:{scope,command}})
  }

  async applyRemote(entity, localId, payload, scope) {
    await this.requireBridge(entity)
    if (payload?.deleted) throw new Error('Exclusão remota exige revisão manual no cadastro central.')
    const current = await this.getBridge(entity, localId, scope)
    if (!current) return false
    // Never write a complete cloud projection back into central SQLite.
    // Only explicitly editable fields may be applied; financial / stock / document
    // projections are read-only and their domain services remain authoritative.
    const allowed=EDITABLE[entity]||[]
    const patch=Object.fromEntries(allowed.filter(key=>Object.hasOwn(payload,key)).map(key=>[key,payload[key]]))
    if(Object.keys(patch).length)
      await this.lanClient.save(entity, { ...current, ...patch, id: Number(localId), obra_id: current.obra_id })
    return true
  }

  async summary(scope, modules = []) {
    await this.requireModule('summary')
    return this.lanClient.request('GET', `/api/v1/sync-source/summary${syncSourceQuery(scope, modules)}`)
  }

  async fieldRdoCatalog(scope) {
    await this.requireModule('operation')
    return this.lanClient.request('GET','/api/v1/field/rdo/catalog',{
      query:{obra_id:scope.workId,remote_company_id:scope.remoteCompanyId}
    })
  }

  async applyFieldRdo(scope,report) {
    await this.requireModule('operation')
    return this.lanClient.request('POST', '/api/v1/field/rdo/import-mobile', { body:{scope,report} })
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
    if (mode === 'lan-host' || mode === 'remote') return { source: mode, paused: false, pauseReason: null }
    return { source: mode, paused: true, pauseReason: PAUSE_REASONS[mode] || 'Sincronização pausada para esta fonte operacional.' }
  }

  activeProvider() {
    const runtime = this.runtimeState()
    if (runtime.paused) throw new Error(`Sincronização pausada: ${runtime.pauseReason}`)
    if (runtime.source === 'lan-host' || runtime.source === 'remote') return this.lanProvider
    if (!this.localProvider) throw new Error('Fonte local de sincronização indisponível.')
    return this.localProvider
  }

  async syncCapabilities() {
    const runtime = this.runtimeState()
    if (runtime.paused) throw new Error(`Sincronização pausada: ${runtime.pauseReason}`)
    if (runtime.source !== 'lan-host' && runtime.source !== 'remote') return null
    return this.lanProvider.capabilities()
  }

  async resolveScope(input) { return this.activeProvider().resolveScope(input) }
  async listBridge(entity, scope) { return this.activeProvider().listBridge(entity, scope) }
  async getBridge(entity, localId, scope) { return this.activeProvider().getBridge(entity, localId, scope) }
  async summary(scope, modules) { return this.activeProvider().summary(scope, modules) }
  async obligations(scope) { return this.activeProvider().obligations(scope) }
  async applyWebP0Create(scope,command) {
    const runtime=this.runtimeState()
    if(runtime.paused)throw new Error('Sincronização operacional pausada.')
    if(runtime.source==='local')return this.localProvider.applyWebP0Create(scope,command)
    if(runtime.source==='lan-host'||runtime.source==='remote')return this.lanProvider.applyWebP0Create(scope,command)
    throw new Error('Fonte operacional indisponível para criação Web.')
  }
  async applyRemote(entity, localId, payload, scope) { return this.activeProvider().applyRemote(entity, localId, payload, scope) }
  async applyFieldRdo(scope,report) { return this.activeProvider().applyFieldRdo(scope,report) }
  async fieldRdoCatalog(scope) { return this.activeProvider().fieldRdoCatalog(scope) }
}

module.exports = { LanSyncDataProvider, OperationalSyncDataProvider }
