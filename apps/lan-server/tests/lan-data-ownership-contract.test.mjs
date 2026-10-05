import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { MODULE_TABLES } from '../src/migration-service.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const contract = JSON.parse(fs.readFileSync(path.resolve(here, '../../../packages/contracts/lan-data-contract.json'), 'utf8'))

test('LAN Server usa exatamente o contrato RH da fase 1', () => {
  assert.deepEqual(MODULE_TABLES.rh, contract.phase1RhMigration.tables)
})

test('contrato target não possui entidade compartilhada com owner duplicado', () => {
  const owner = new Map()
  for (const [moduleName, spec] of Object.entries(contract.targetModules)) {
    for (const table of spec.tables) {
      assert.equal(owner.has(table), false, `${table} duplicada entre ${owner.get(table)} e ${moduleName}`)
      owner.set(table, moduleName)
    }
  }
  for (const table of contract.localOnly) assert.equal(owner.has(table), false, `${table} não pode ser shared e local-only`)
})
