import assert from 'node:assert/strict'
import test from 'node:test'
import { createRuntimeLogger, redactRuntimeValue } from '../src/runtime-logger.mjs'

function sinkFixture() {
  const entries = []
  return {
    entries,
    sink: {
      log(value) { entries.push(value) },
      warn(value) { entries.push(value) },
      error(value) { entries.push(value) }
    }
  }
}

test('runtime logger emits structured supervisor-friendly JSON', () => {
  const { sink, entries } = sinkFixture()
  const logger = createRuntimeLogger({ sink, now: () => new Date('2026-10-01T12:00:00.000Z') })
  logger.info('server_started', { version: '0.3.0', host: '127.0.0.1', port: 4732 })

  assert.equal(entries.length, 1)
  assert.deepEqual(JSON.parse(entries[0]), {
    ts: '2026-10-01T12:00:00.000Z',
    level: 'info',
    event: 'server_started',
    version: '0.3.0',
    host: '127.0.0.1',
    port: 4732
  })
})

test('runtime logger redacts nested credentials, setup codes and bearer values', () => {
  const { sink, entries } = sinkFixture()
  const logger = createRuntimeLogger({ sink })
  logger.error('startup_failed', {
    token: 'token-secret',
    nested: { password: 'password-secret', snapshot: { secret: 'snapshot-secret' } },
    error: new Error('Authorization: Bearer bearer-secret; token=query-secret; code ABCDE-12345')
  })

  const serialized = entries.join('\n')
  for (const secret of ['token-secret', 'password-secret', 'snapshot-secret', 'bearer-secret', 'query-secret', 'ABCDE-12345']) {
    assert.equal(serialized.includes(secret), false)
  }
  assert.ok(serialized.includes('[REDACTED]'))
})

test('redaction leaves ordinary operational fields intact', () => {
  assert.deepEqual(redactRuntimeValue({ version: '1.2.3', schemaVersion: 20, status: 'ready' }), {
    version: '1.2.3', schemaVersion: 20, status: 'ready'
  })
})
