const { LanDataClient, CORE_REMOTE_TABLES, OPERATION_REMOTE_TABLES } = require('./lan-data-client.cjs')
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
  }

  transportReady() {
    const state = this.storage.state()
    const operationalMode = state.operationalMode || (state.mode === 'server' ? 'lan-client' : 'local')
    return state.mode === 'server' && ['lan-client', 'lan-host'].includes(operationalMode)
  }

  route(table) {
    if (!this.transportReady()) return 'local'
    if (CORE_REMOTE_TABLES.has(table)) return 'remote'
    if (!OPERATION_REMOTE_TABLES.has(table)) return 'local'

    const moduleState = this.moduleStorage?.state?.('operation')?.state
    if (moduleState === 'central-active') return 'remote'
    if (moduleState === 'central-ready') return 'blocked'
    return 'local'
  }

  assertRoute(table) {
    const route = this.route(table)
    if (route === 'blocked') {
      throw new Error('O módulo RDO/operação central ainda não está ativo; nenhum dado será salvo localmente como fallback.')
    }
    return route
  }

  async list(table, filters) {
    if (this.assertRoute(table) === 'remote') return this.remote.list(table, filters)
    return this.db.list(table, filters)
  }

  async get(table, id) {
    if (this.assertRoute(table) === 'remote') return this.remote.get(table, id)
    return this.db.get(table, id)
  }

  async save(table, data) {
    if (this.assertRoute(table) === 'remote') return this.remote.save(table, data)
    return this.db.save(table, data)
  }

  async remove(table, id) {
    if (this.assertRoute(table) === 'remote') return this.remote.remove(table, id)
    return this.db.remove(table, id)
  }
}

module.exports = { DataAccessService }
