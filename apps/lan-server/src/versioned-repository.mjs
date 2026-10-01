import { ConcurrencyService } from './concurrency-service.mjs'

export class VersionedRepository {
  constructor({ repository }) {
    const db = repository?.connection?.()
    if (!repository || !db?.prepare || !db?.exec) throw new Error('Repositório LAN incompatível com concorrência otimista.')
    db.prepare('SELECT revision FROM record_revisions LIMIT 1').all()
    this.repository = repository
    this.db = db
    this.concurrency = new ConcurrencyService({ db })
  }

  decorate(table, row) {
    if (!row) return null
    const revision = this.concurrency.current(table, row.id) || this.concurrency.initialize(table, row.id)
    return { ...row, revision }
  }

  list(table, filters = {}) {
    return this.repository.list(table, filters).map(row => this.decorate(table, row))
  }

  get(table, id) {
    return this.decorate(table, this.repository.get(table, id))
  }

  create(table, data) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const saved = this.repository.save(table, data)
      if (!saved) {
        this.db.exec('ROLLBACK')
        return null
      }
      this.concurrency.initialize(table, saved.id)
      const result = this.decorate(table, saved)
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  update(table, id, expectedRevision, data) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.repository.get(table, id)
      if (!current) {
        this.db.exec('ROLLBACK')
        return null
      }
      const observed = this.concurrency.current(table, id) || this.concurrency.initialize(table, id)
      this.concurrency.assertExpected(table, id, expectedRevision, { ...current, revision: observed })
      const saved = this.repository.save(table, { ...data, id: Number(id) })
      if (!saved) {
        this.db.exec('ROLLBACK')
        return null
      }
      const revision = this.concurrency.bump(table, id)
      const result = { ...saved, revision }
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  remove(table, id, expectedRevision) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.repository.get(table, id)
      if (!current) {
        this.db.exec('ROLLBACK')
        return false
      }
      const observed = this.concurrency.current(table, id) || this.concurrency.initialize(table, id)
      this.concurrency.assertExpected(table, id, expectedRevision, { ...current, revision: observed })
      const removed = this.repository.remove(table, id)
      if (!removed) {
        this.db.exec('ROLLBACK')
        return false
      }
      this.concurrency.remove(table, id)
      this.db.exec('COMMIT')
      return true
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}

export function createVersionedRepository(repository) {
  try {
    return new VersionedRepository({ repository })
  } catch {
    return null
  }
}
