import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
const preload=fs.readFileSync(path.resolve(process.cwd(),'electron/preload.cjs'),'utf8')

describe('F29/F30 server setup and assisted migration',()=>{
  it('keeps one guided setup journey while preserving LAN discovery and remote secure connection',()=>{
    expect(source).toContain("const SETUP_STEPS")
    expect(source).toContain('Identificação')
    expect(source).toContain('Rede')
    expect(source).toContain('Backup')
    expect(source).toContain('Segurança')
    expect(source).toContain('Validação')
    expect(source).toContain('Configurar uso compartilhado')
    expect(source).toContain('Encontrar a empresa nesta rede')
    expect(source).toContain('Acesso remoto avançado — servidor próprio')
    expect(source).toContain('HTTP público é bloqueado')
  })

  it('orchestrates mandatory migration order through the existing migration API only',()=>{
    expect(source).toContain("const MODULE_ORDER:ModuleKey[]=['core','operation','planning','finance','rh','documents']")
    expect(source).toContain('centralizeAll')
    expect(source).toContain('migrationPreflight')
    expect(source).toContain('migrateModule')
    expect(source).toContain('refreshModuleCapabilities')
    expect(source).not.toContain('forceCentralActive')
    expect(source).not.toContain('setModuleState')
    expect(source).not.toContain('Migrar para servidor')
  })

  it('keeps technical recovery with app-owned confirmation and exposes server operations',()=>{
    expect(source).toContain('Avançado e diagnóstico')
    expect(source).toContain('Tentar novamente')
    expect(source).toContain('Reverter tentativa')
    expect(source).toContain('<Confirm')
    expect(source).not.toContain('window.confirm')
    expect(source).toContain('Operação do servidor')
    expect(source).toContain('Criar backup agora')
    expect(preload).toContain('operationsStatus')
    expect(preload).toContain('listBackups')
    expect(preload).toContain('testBackup')
    expect(preload).toContain('preUpgradeBackup')
  })
})
