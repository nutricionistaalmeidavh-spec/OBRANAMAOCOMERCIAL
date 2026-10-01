export class RevisionConflictError extends Error {
  constructor({ resourceType, resourceId, expectedRevision, currentRevision, current = null }) {
    super('Este registro foi alterado em outro computador.')
    this.name = 'RevisionConflictError'
    this.code = 'revision_conflict'
    this.status = 409
    this.resourceType = String(resourceType)
    this.resourceId = String(resourceId)
    this.expectedRevision = Number(expectedRevision)
    this.currentRevision = Number(currentRevision)
    this.current = current ?? null
  }
}

export class ConcurrencyService {
  constructor({ db, now = () => new Date().toISOString() }) {
    if (!db?.prepare) throw new Error('Banco central LAN inválido para concorrência.')
    this.db = db
    this.now = now
  }

  key(resourceType, resourceId) {
    const type = String(resourceType || '').trim()
    const id = String(resourceId ?? '').trim()
    if (!type || !id) throw new Error('Recurso inválido para controle de revisão.')
    return { type, id }
  }

  current(resourceType, resourceId) {
    const { type, id } = this.key(resourceType, resourceId)
    const row = this.db.prepare('SELECT revision FROM record_revisions WHERE resource_type=? AND resource_id=?')
      .get(type, id)
    return Number(row?.revision || 0)
  }

  initialize(resourceType, resourceId) {
    const { type, id } = this.key(resourceType, resourceId)
    this.db.prepare(`INSERT INTO record_revisions(resource_type,resource_id,revision,updated_at)
      VALUES(?,?,1,?)
      ON CONFLICT(resource_type,resource_id) DO NOTHING`)
      .run(type, id, this.now())
    return this.current(type, id)
  }

  assertExpected(resourceType, resourceId, expectedRevision, current = null) {
    const { type, id } = this.key(resourceType, resourceId)
    const expected = Number(expectedRevision)
    if (!Number.isInteger(expected) || expected < 1) throw new Error('expectedRevision inválida ou ausente.')
    const actual = this.current(type, id) || this.initialize(type, id)
    if (actual !== expected) {
      throw new RevisionConflictError({
        resourceType: type,
        resourceId: id,
        expectedRevision: expected,
        currentRevision: actual,
        current
      })
    }
    return actual
  }

  bump(resourceType, resourceId) {
    const { type, id } = this.key(resourceType, resourceId)
    const current = this.current(type, id)
    if (!current) this.initialize(type, id)
    this.db.prepare('UPDATE record_revisions SET revision=revision+1,updated_at=? WHERE resource_type=? AND resource_id=?')
      .run(this.now(), type, id)
    return this.current(type, id)
  }

  remove(resourceType, resourceId) {
    const { type, id } = this.key(resourceType, resourceId)
    this.db.prepare('DELETE FROM record_revisions WHERE resource_type=? AND resource_id=?').run(type, id)
  }
}
