import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('StorageServerSettings migration contract',()=>{
  const source=fs.readFileSync(path.resolve(import.meta.dirname,'StorageServerSettings.tsx'),'utf8')

  it('mostra os cinco blocos de armazenamento central',()=>{
    expect(source).toContain("const keys:ModuleKey[]=['core','operation','planning','finance','rh']")
    expect(source).toContain('storageApi.moduleState(key)')
    for(const label of ['Cadastros-base','RDO / operação','Planejamento','Financeiro','RH']) expect(source).toContain(label)
  })

  it('oferece migração explícita com backup sem controle de força',()=>{
    expect(source).toContain('migrateModule')
    expect(source).toMatch(/backup/i)
    expect(source).toMatch(/dados locais|base local/i)
    expect(source).not.toContain('forceCentralActive')
    expect(source).not.toContain('setModuleState')
  })

  it('bloqueia módulos dependentes enquanto core não estiver central-active',()=>{
    expect(source).toContain("core?.state!=='central-active'")
    expect(source).toContain('coreDependencyBlocked')
  })
})
