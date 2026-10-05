import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('StorageServerSettings migration contract',()=>{
  const source=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')

  it('mantém a ordem segura dos seis módulos como detalhe interno',()=>{
    for(const module of ['core','operation','planning','finance','rh','documents']) expect(source).toMatch(new RegExp(`(?:${module}:'|['\\"]${module}['\\"])`))
    for(const label of ['Cadastros-base','RDO / operação','Planejamento','Financeiro','RH','Documentos']) expect(source).toContain(label)
    expect(source).toContain("const MODULE_ORDER:ModuleKey[]=['core','operation','planning','finance','rh','documents']")
    for(const state of ['local','migration-required','central-ready','central-active']) expect(source).toContain(state)
  })

  it('orquestra a migração automaticamente em uma única configuração',()=>{
    expect(source).toContain('centralizeAll')
    expect(source).toContain('Configurar uso compartilhado')
    expect(source).toContain('migrateModule')
    expect(source).toContain('migrationPreflight')
    expect(source).toContain('refreshModuleCapabilities')
    expect(source).toMatch(/backup/i)
    expect(source).not.toContain('Migrar para servidor')
  })

  it('não expõe ações permanentes por módulo no happy path',()=>{
    expect(source).not.toContain('const renderModule')
    expect(source).toContain('Avançado e diagnóstico')
    expect(source).toContain('<progress')
    expect(source).toContain('storage-module-list')
    expect(source).toContain('Servidor pronto')
  })

  it('mantém retry idempotente e rollback como recuperação técnica',()=>{
    expect(source).toContain('Tentar novamente')
    expect(source).toContain('rollbackModuleMigration')
    expect(source).toContain('Reverter tentativa')
    expect(source).toContain('<Confirm')
    expect(source).not.toContain('window.confirm')
    expect(source).not.toContain('forceCentralActive')
    expect(source).not.toContain('setModuleState')
  })

  it('preserva bloqueios de segurança e não força ativação central',()=>{
    expect(source).toContain('preflight?.canMigrate')
    expect(source).toContain("status?.credential?.member?.role!=='admin'")
    expect(source).toContain("state?.state!=='central-active'")
    expect(source).not.toContain('permissionMatrix')
    expect(source).not.toContain('granularPermissions')
  })
})
