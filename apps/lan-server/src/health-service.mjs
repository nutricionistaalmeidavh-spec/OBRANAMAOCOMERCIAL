export function createHealthService({ centralStorage, expectedSchemaVersion } = {}) {
  if (!centralStorage?.health) throw new Error('Health service exige diagnóstico do storage central.')
  if (!Number.isInteger(Number(expectedSchemaVersion))) throw new Error('Health service exige schema esperado válido.')
  const expected = Number(expectedSchemaVersion)

  const service = {
    readiness() {
      const raw = centralStorage.health() || {}
      const reasons = []
      const accessible = raw.accessible === true
      const integrity = String(raw.integrity || 'unknown')
      const schemaVersion = Number.isFinite(Number(raw.schemaVersion)) ? Number(raw.schemaVersion) : null
      const claimed = raw.claimed === true
      const serverId = raw.serverId ? String(raw.serverId) : null
      const companyId = raw.companyId ? String(raw.companyId) : null

      if (!accessible) reasons.push('database_unavailable')
      if (accessible && integrity !== 'ok') reasons.push('database_integrity_failed')
      if (schemaVersion !== expected) reasons.push('schema_mismatch')
      if (claimed && !serverId) reasons.push('identity_invalid')
      if (raw.maintenance === true) reasons.push('storage_maintenance')

      const ready = reasons.length === 0
      return Object.freeze({
        ready,
        status: ready ? 'ready' : 'not_ready',
        reasons,
        database: Object.freeze({ accessible, integrity, schemaVersion }),
        identity: Object.freeze({ claimed, serverId, companyId })
      })
    },
    readinessResponse() {
      const body = service.readiness()
      return Object.freeze({ statusCode: body.ready ? 200 : 503, body })
    }
  }

  return Object.freeze(service)
}
