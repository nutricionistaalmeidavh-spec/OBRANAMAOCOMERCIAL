import assert from 'node:assert/strict'
import test from 'node:test'
import { createHealthService } from '../src/health-service.mjs'

function storage(overrides = {}) {
  return {
    health: () => ({
      accessible: true,
      integrity: 'ok',
      schemaVersion: 6,
      claimed: true,
      serverId: 'server-a',
      companyId: 'company-a',
      maintenance: false,
      ...overrides
    })
  }
}

test('readiness is ready when local storage, schema and identity are valid', () => {
  const service = createHealthService({ centralStorage: storage(), expectedSchemaVersion: 6 })
  const result = service.readiness()

  assert.equal(result.ready, true)
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.database, { accessible: true, integrity: 'ok', schemaVersion: 6 })
  assert.deepEqual(result.identity, { claimed: true, serverId: 'server-a', companyId: 'company-a' })
})

test('readiness does not depend on Cloud connectivity', () => {
  const service = createHealthService({ centralStorage: storage(), expectedSchemaVersion: 6 })
  assert.equal(service.readiness().ready, true)
})

test('readiness fails for inaccessible, corrupt or incompatible storage', () => {
  const cases = [
    [storage({ accessible: false }), 'database_unavailable'],
    [storage({ integrity: 'failed' }), 'database_integrity_failed'],
    [storage({ schemaVersion: 5 }), 'schema_mismatch']
  ]

  for (const [centralStorage, reason] of cases) {
    const result = createHealthService({ centralStorage, expectedSchemaVersion: 6 }).readiness()
    assert.equal(result.ready, false)
    assert.equal(result.status, 'not_ready')
    assert.ok(result.reasons.includes(reason))
  }
})

test('claimed server without stable local identity is not ready', () => {
  const service = createHealthService({
    centralStorage: storage({ claimed: true, serverId: null }),
    expectedSchemaVersion: 6
  })
  const result = service.readiness()

  assert.equal(result.ready, false)
  assert.ok(result.reasons.includes('identity_invalid'))
})

test('readiness payload is allowlisted and does not leak storage secrets', () => {
  const service = createHealthService({
    centralStorage: storage({
      token: 'token-secret',
      setupCode: 'setup-secret',
      snapshot: { secret: 'snapshot-secret' },
      error: 'internal path /secret'
    }),
    expectedSchemaVersion: 6
  })
  const serialized = JSON.stringify(service.readiness())

  for (const secret of ['token-secret', 'setup-secret', 'snapshot-secret', '/secret']) {
    assert.equal(serialized.includes(secret), false)
  }
})

test('readinessResponse maps readiness to HTTP 200 or 503 without changing the payload', () => {
  const ready = createHealthService({ centralStorage: storage(), expectedSchemaVersion: 6 })
  const unavailable = createHealthService({ centralStorage: storage({ accessible: false }), expectedSchemaVersion: 6 })

  const ok = ready.readinessResponse()
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.body.ready, true)

  const down = unavailable.readinessResponse()
  assert.equal(down.statusCode, 503)
  assert.equal(down.body.ready, false)
})
