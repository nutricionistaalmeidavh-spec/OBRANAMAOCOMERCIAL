import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('module migration database allowlist',()=>{
  it('allows every table exported by every migration module',()=>{
    const { TABLES } = require('./database.cjs')
    const { MODULE_TABLES } = require('./module-migration-service.cjs')

    for (const [moduleName, tables] of Object.entries(MODULE_TABLES as Record<string,string[]>)) {
      for (const table of tables) {
        expect(TABLES.has(table), `${moduleName} migration table ${table} must be allowed by DatabaseService`).toBe(true)
      }
    }
  })
})
