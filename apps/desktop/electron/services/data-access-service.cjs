const { LanDataClient, REMOTE_TABLES } = require('./lan-data-client.cjs')
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
  constructor({ db, storage = null, remote = null, credentials = null }) {
    this.db = db
    this.storage = storage || new StorageConnectionService({ db })
    this.credentials = credentials || defaultCredentials(db)
    this.remote = remote || new LanDataClient({ storage: this.storage, credentials: this.credentials })
  }

  useRemote(table) {
    const state = this.storage.state()
    const operationalMode = state.operationalMode || (state.mode === 'server' ? 'lan-client' : 'local')
    return state.mode === 'server' && ['lan-client', 'lan-host'].includes(operationalMode) && REMOTE_TABLES.has(table)
  }

  list(table, filters) {
    if (this.useRemote(table)) return this.remote.list(table, filters)
    return this.db.list(table, filters)
  }

  get(table, id) {
    if (this.useRemote(table)) return this.remote.get(table, id)
    return this.db.get(table, id)
  }

  save(table, data) {
    if (this.useRemote(table)) return this.remote.save(table, data)
    return this.db.save(table, data)
  }

  remove(table, id) {
    if (this.useRemote(table)) return this.remote.remove(table, id)
    return this.db.remove(table, id)
  }
}

module.exports = { DataAccessService }
