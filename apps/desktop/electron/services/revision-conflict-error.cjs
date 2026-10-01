class RevisionConflictError extends Error {
  constructor(payload = {}) {
    super('Este registro foi alterado em outro computador.')
    this.name = 'RevisionConflictError'
    this.code = 'revision_conflict'
    this.status = 409
    this.resourceType = payload.resourceType || null
    this.resourceId = payload.resourceId === undefined || payload.resourceId === null ? null : String(payload.resourceId)
    this.expectedRevision = Number(payload.expectedRevision)
    this.currentRevision = Number(payload.currentRevision)
    this.current = payload.current || null
  }
}

module.exports = { RevisionConflictError }
