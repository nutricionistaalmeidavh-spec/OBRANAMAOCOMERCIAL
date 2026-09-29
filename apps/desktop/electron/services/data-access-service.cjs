class DataAccessService {
  constructor({ db }) {
    this.db = db
  }

  list(table, filters) {
    return this.db.list(table, filters)
  }

  get(table, id) {
    return this.db.get(table, id)
  }

  save(table, data) {
    return this.db.save(table, data)
  }

  remove(table, id) {
    return this.db.remove(table, id)
  }
}

module.exports = { DataAccessService }
