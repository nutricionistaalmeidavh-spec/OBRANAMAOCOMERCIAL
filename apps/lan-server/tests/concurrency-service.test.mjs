import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { ConcurrencyService, RevisionConflictError } from '../src/concurrency-service.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationPath = path.join(here, '..', 'migrations', '020_record_revisions.sql')

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(fs.readFileSync(migrationPath, 'utf8'))
  const service = new ConcurrencyService({ db, now: () => '2026-10-01T12:00:00.000Z' })
  return { db, service }
}

test('initialize creates revision 1 and current reads it', () => {
  const { db, service } = fixture()
  assert.equal(service.initialize('obras', 10), 1)
  assert.equal(service.current('obras', 10), 1)
  db.close()
})

test('initialize is idempotent for the same resource', () => {
  const { db, service } = fixture()
  assert.equal(service.initialize('obras', 10), 1)
  assert.equal(service.bump('obras', 10), 2)
  assert.equal(service.initialize('obras', 10), 2)
  db.close()
})

test('assertExpected accepts the observed revision and rejects a stale revision', () => {
  const { db, service } = fixture()
  service.initialize('obras', 10)
  assert.equal(service.assertExpected('obras', 10, 1), 1)
  service.bump('obras', 10)
  assert.throws(
    () => service.assertExpected('obras', 10, 1, { id: 10, nome: 'Atual' }),
    error => error instanceof RevisionConflictError
      && error.code === 'revision_conflict'
      && error.resourceType === 'obras'
      && error.resourceId === '10'
      && error.expectedRevision === 1
      && error.currentRevision === 2
      && error.current?.nome === 'Atual'
  )
  db.close()
})

test('bump increments revision and remove deletes the sidecar state', () => {
  const { db, service } = fixture()
  service.initialize('obras', 10)
  assert.equal(service.bump('obras', 10), 2)
  assert.equal(service.bump('obras', 10), 3)
  service.remove('obras', 10)
  assert.equal(service.current('obras', 10), 0)
  db.close()
})

test('resource type and id are isolated', () => {
  const { db, service } = fixture()
  service.initialize('obras', 10)
  service.initialize('clientes', 10)
  service.initialize('obras', 11)
  service.bump('obras', 10)
  assert.equal(service.current('obras', 10), 2)
  assert.equal(service.current('clientes', 10), 1)
  assert.equal(service.current('obras', 11), 1)
  db.close()
})
