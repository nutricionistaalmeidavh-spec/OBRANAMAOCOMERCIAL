import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('StorageServerSettings migration UI contract',()=>{
  it('shows all five storage blocks and explicit migration action',()=>{
    const source=fs.readFileSync(path.resolve(import.meta.dirname,'StorageServerSettings.tsx'),'utf8')
    for(const label of ['Cadastros-base','RDO / operação','Planejamento','Financeiro','RH']) expect(source).toContain(label)
    expect(source).toContain('migrateModule')
    expect(source).toMatch(/backup/i)
    expect(source).toMatch(/não (?:será|serão) apag/i)
    expect(source).not.toContain('financeDependencyBlocked')
    expect(source).not.toContain('Financeiro e RH permanecem no comportamento atual')
  })
})
