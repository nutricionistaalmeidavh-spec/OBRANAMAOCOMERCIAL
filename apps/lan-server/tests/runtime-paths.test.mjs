import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { ensureRuntimePaths, resolveRuntimePaths } from '../src/runtime-paths.mjs'

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'obra-na-mao-runtime-paths-'))
}

test('runtime paths are deterministic and keep data, backup and logs distinct', () => {
  const root = tempRoot()
  const config = {
    dataDir: path.join(root, 'data'),
    backupDir: path.join(root, 'backup'),
    logDir: path.join(root, 'log')
  }

  const first = resolveRuntimePaths(config, { migrationsDir: path.join(root, 'migrations') })
  const second = resolveRuntimePaths(config, { migrationsDir: path.join(root, 'migrations') })

  assert.deepEqual(first, second)
  assert.equal(first.databasePath, path.join(root, 'data', 'obra-na-mao-lan.sqlite'))
  assert.equal(first.dataDir, path.join(root, 'data'))
  assert.equal(first.backupDir, path.join(root, 'backup'))
  assert.equal(first.logDir, path.join(root, 'log'))
  assert.equal(first.migrationsDir, path.join(root, 'migrations'))
  assert.equal(new Set([first.dataDir, first.backupDir, first.logDir]).size, 3)
  assert.equal(Object.isFrozen(first), true)
})

test('ensureRuntimePaths creates required writable directories idempotently', () => {
  const root = tempRoot()
  const paths = resolveRuntimePaths({
    dataDir: path.join(root, 'data'),
    backupDir: path.join(root, 'backup'),
    logDir: path.join(root, 'log')
  }, { migrationsDir: path.join(root, 'migrations') })

  assert.doesNotThrow(() => ensureRuntimePaths(paths))
  assert.doesNotThrow(() => ensureRuntimePaths(paths))

  for (const directory of [paths.dataDir, paths.backupDir, paths.logDir]) {
    assert.equal(fs.statSync(directory).isDirectory(), true)
  }
})

test('invalid runtime directory fails explicitly instead of falling back elsewhere', () => {
  const root = tempRoot()
  const occupiedByFile = path.join(root, 'not-a-directory')
  fs.writeFileSync(occupiedByFile, 'occupied')

  const paths = resolveRuntimePaths({
    dataDir: occupiedByFile,
    backupDir: path.join(root, 'backup'),
    logDir: path.join(root, 'log')
  }, { migrationsDir: path.join(root, 'migrations') })

  assert.throws(() => ensureRuntimePaths(paths), /diretório de runtime|directory|diretório/i)
  assert.equal(fs.existsSync(path.join(root, 'fallback')), false)
})
