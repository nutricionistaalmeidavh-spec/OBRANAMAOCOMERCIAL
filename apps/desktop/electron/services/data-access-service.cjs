const { LanDataClient, CORE_REMOTE_TABLES, OPERATION_REMOTE_TABLES, PLANNING_REMOTE_TABLES, FINANCE_REMOTE_TABLES, RH_REMOTE_TABLES } = require('./lan-data-client.cjs')
const { StorageConnectionService } = require('./storage-connection-service.cjs')
const { LanCredentialService } = require('./lan-credential-service.cjs')

function electronSafeStorage() {
  try {
    const electron = require('electron')
    return electron && typeof electron === 'object' ? electron.safeStorage : null
  } catch {
    return null
  }
}

function defaultCredentials(db) {
  if (!db?.dataDir) return null
  return new LanCredentialService({ dataDir: db.dataDir, safeStorage: electronSafeStorage() })
}

class DataAccessService {
  constructor({ db, storage = null, remote = null, credentials = null, moduleStorage = null }) {
    this.db = db
    this.storage = storage || new StorageConnectionService({ db })
    this.credentials = credentials || defaultCredentials(db)
    this.remote = remote || new LanDataClient({ storage: this.storage, credentials: this.credentials })
    this.moduleStorage = moduleStorage
    this.observedRevisions = new Map()
  }

  revisionKey(table, id) {
    return `${table}:${Number(id)}`
  }

  rememberRevision(table, value) {
    if (!value || value.id === undefined || value.id === null || !Number.isFinite(Number(value.revision))) return value
    this.observedRevisions.set(this.revisionKey(table, value.id), Number(value.revision))
    return value
  }

  rememberMany(table, values) {
    if (Array.isArray(values)) for (const value of values) this.rememberRevision(table, value)
    return values
  }

  transportReady() {
    const state = this.storage.state()
    const operationalMode = state.operationalMode || (state.mode === 'server' ? 'lan-client' : 'local')
    return state.mode === 'server' && ['lan-client', 'lan-host'].includes(operationalMode)
  }

  moduleForTable(table) {
    if (CORE_REMOTE_TABLES.has(table)) return 'core'
    if (OPERATION_REMOTE_TABLES.has(table)) return 'operation'
    if (PLANNING_REMOTE_TABLES.has(table)) return 'planning'
    if (FINANCE_REMOTE_TABLES.has(table)) return 'finance'
    if (RH_REMOTE_TABLES.has(table)) return 'rh'
    return null
  }

  route(table) {
    if (!this.transportReady()) return 'local'
    const module = this.moduleForTable(table)
    if (!module) return 'local'

    const moduleState = this.moduleStorage?.state?.(module)?.state
    if (moduleState === 'central-active') return 'remote'
    if (moduleState === 'migration-required' || moduleState === 'local') return 'local'
    return 'blocked'
  }

  assertRoute(table) {
    const route = this.route(table)
    if (route === 'blocked') {
      const module = this.moduleForTable(table)
      const label = module === 'core' ? 'Cadastros-base' : module === 'planning' ? 'Planejamento' : module === 'finance' ? 'Financeiro' : module === 'rh' ? 'RH' : 'RDO/operação'
      throw new Error(`O módulo ${label} central ainda não está ativo; nenhum dado será salvo localmente como fallback.`)
    }
    return route
  }

  async list(table, filters) {
    if (this.assertRoute(table) === 'remote') return this.rememberMany(table, await this.remote.list(table, filters))
    return this.db.list(table, filters)
  }

  async get(table, id) {
    if (this.assertRoute(table) === 'remote') return this.rememberRevision(table, await this.remote.get(table, id))
    return this.db.get(table, id)
  }

  async save(table, data) {
    if (this.assertRoute(table) === 'remote') return this.rememberRevision(table, await this.remote.save(table, data))
    return this.db.save(table, data)
  }

  async remove(table, id, expectedRevision) {
    if (this.assertRoute(table) === 'remote') {
      const observedRevision = expectedRevision ?? this.observedRevisions.get(this.revisionKey(table, id))
      const removed = await this.remote.remove(table, id, observedRevision)
      if (removed) this.observedRevisions.delete(this.revisionKey(table, id))
      return removed
    }
    return this.db.remove(table, id)
  }
}

module.exports = { DataAccessService }
