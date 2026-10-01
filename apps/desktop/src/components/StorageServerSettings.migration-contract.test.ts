import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('StorageServerSettings migration contract',()=>{
  const source=fs.readFileSync(path.resolve(import.meta.dirname,'StorageServerSettings.tsx'),'utf8')

  it('mostra os cinco blocos de armazenamento central',()=>{
    for(const module of ['core','operation','planning','finance','rh']) expect(source).toMatch(new RegExp(`(?:${module}:'|['\"]${module}['\"])`))
    for(const label of ['Cadastros-base','RDO / operação','Planejamento','Financeiro','RH']) expect(source).toContain(label)
    for(const state of ['local','migration-required','central-ready','central-active']) expect(source).toContain(state)
  })

  it('oferece migração explícita com backup e preservação local sem controle de força',()=>{
    expect(source).toContain('migrateModule')
    expect(source).toContain('Migrar para servidor')
    expect(source).toMatch(/backup/i)
    expect(source).toMatch(/dados locais|base local/i)
    expect(source).toMatch(/não serão apagados|permanecem intactos/i)
    expect(source).not.toContain('forceCentralActive')
    expect(source).not.toContain('setModuleState')
  })

  it('respeita toda a cadeia de dependências antes da migração',()=>{
    expect(source).toContain('dependencyBlockedBy')
    expect(source).toContain('blockedBy')
    expect(source).toContain('Conclua a migração/ativação desse bloco')
  })

  it('expõe retry idempotente e rollback explícito de tentativa pendente',()=>{
    expect(source).toContain('migrationStatus')
    expect(source).toContain('Tentar novamente')
    expect(source).toContain('rollbackModuleMigration')
    expect(source).toContain('Reverter tentativa')
    expect(source).toMatch(/reutiliza a mesma tentativa|evitar duplicação/i)
  })

  it('não introduz UX de F14 F15 ou F16',()=>{
    expect(source).not.toContain('expectedRevision')
    expect(source).not.toContain('forceCentralActive')
    expect(source).not.toContain('permissionMatrix')
    expect(source).not.toContain('granularPermissions')
  })
})
