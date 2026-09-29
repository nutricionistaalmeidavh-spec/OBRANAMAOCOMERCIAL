const { LanDataClient, REMOTE_TABLES } = require('./lan-data-client.cjs')

class DataAccessService {
  constructor({ db, storage = null, remote = null }) {
    this.db = db
    this.storage = storage
    this.remote = remote || (storage ? new LanDataClient({ storage }) : null)
  }

  useRemote(table) {
    return Boolean(this.storage && this.remote && this.storage.state().mode === 'server' && REMOTE_TABLES.has(table))
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
