import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { RuntimeBackupService } from '../src/runtime-backup-service.mjs'

function createService(overrides = {}) {
  return new RuntimeBackupService({
    repository: { connection() { return {} }, close() {} },
    security: { serverState() { return null } },
    dataDir: path.resolve('/srv/obra/data'),
    migrationsDir: path.resolve('/srv/obra/migrations'),
    ...overrides
  })
}

test('runtime backup service uses configured backupDir without duplicating backup logic', () => {
  const service = createService({ backupDir: '/srv/obra/custom-backup' })
  assert.equal(service.backupsRoot(), path.join(path.resolve('/srv/obra/custom-backup'), 'central'))
})

test('runtime backup service preserves the legacy dataDir/backups default', () => {
  const service = createService()
  assert.equal(service.backupsRoot(), path.join(path.resolve('/srv/obra/data'), 'backups', 'central'))
})
