import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { MODULE_TABLES } = require('../electron/services/module-migration-service.cjs')
const contract = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../packages/contracts/lan-data-contract.json'), 'utf8'))

describe('LAN data ownership contract v1', () => {
  it('atribui cada entidade compartilhada a um único owner canônico', () => {
    const owners = new Map<string,string>()
    for (const [moduleName, spec] of Object.entries(contract.targetModules) as any) {
      for (const table of spec.tables as string[]) {
        expect(owners.has(table), `${table} duplicada entre ${owners.get(table)} e ${moduleName}`).toBe(false)
        owners.set(table, moduleName)
      }
    }
    for (const table of contract.localOnly as string[]) expect(owners.has(table), `${table} não pode ser shared e local-only`).toBe(false)
  })

  it('congela o escopo RH da fase 1 igual ao motor de migração Desktop', () => {
    expect(MODULE_TABLES.rh).toEqual(contract.phase1RhMigration.tables)
  })

  it('mantém todas as tabelas RH da fase 1 sob owner RH', () => {
    const rh = new Set(contract.targetModules.rh.tables)
    for (const table of contract.phase1RhMigration.tables as string[]) expect(rh.has(table), table).toBe(true)
  })
})
