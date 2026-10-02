import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const page = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/SettingsPage.tsx'), 'utf8')
const storage = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StorageServerSettings.tsx'), 'utf8')
const preload = fs.readFileSync(path.resolve(process.cwd(), 'electron/preload.cjs'), 'utf8')
const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')
const source = `${page}\n${storage}`

describe('configuracao de dados e servidor', () => {
  it('expõe os três cenários locais/LAN sem remover o padrão local', () => {
    expect(source).toContain('Dados e servidor')
    expect(source).toContain('Somente neste computador')
    expect(source).toContain('Este computador é o principal / servidor local')
    expect(source).toContain('Conectar a um servidor da empresa')
    expect(source).toContain('window.fluxoDre.storage.state()')
    expect(source).toContain('window.fluxoDre.storage.configure')
  })

  it('permite host/porta, teste, claim e pareamento sem expor credenciais', () => {
    expect(source).toContain('Endereço do servidor')
    expect(source).toContain('Porta')
    expect(source).toContain('Testar servidor')
    expect(source).toContain('window.fluxoDre.storage.testConnection()')
    expect(source).toContain('window.fluxoDre.lan.claimHost')
    expect(source).toContain('window.fluxoDre.lan.pair')
    expect(source).not.toContain('deviceToken')
    expect(source).not.toContain('serverToken')
  })

  it('não transforma host vazio de um servidor existente em localhost silenciosamente', () => {
    expect(storage).toContain('host:effectiveHost')
    expect(storage).not.toContain("host:effectiveHost||'127.0.0.1'")
  })

  it('orquestra todos os módulos automaticamente sem centralização silenciosa', () => {
    expect(preload).toContain("call('storage:module-state'")
    expect(main).toContain("ipcMain.handle('storage:module-state'")
    expect(storage).toContain("const MODULE_ORDER:ModuleKey[]=['core','operation','planning','finance','rh']")
    expect(storage).toContain('migrationPreflight')
    expect(storage).toContain('migrateModule')
    expect(storage).toContain('Configurar servidor e migrar dados')
    expect(storage).toContain('central-active')
    expect(storage).not.toContain('Migrar para servidor')
  })

  it('esconde a máquina de estados no happy path e mantém diagnóstico recolhível', () => {
    expect(storage).toContain('Detalhes técnicos')
    expect(storage).toContain('storage-module-list')
    expect(storage).toContain('storage-progress-panel')
    expect(storage).toContain('<progress')
    expect(storage).not.toContain('const renderModule')
  })

  it('mantém retry/rollback explícitos como recovery em vez de ativação forçada', () => {
    expect(storage).toContain('migrationStatus')
    expect(storage).toContain('Tentar novamente')
    expect(storage).toContain('rollbackModuleMigration')
    expect(storage).toContain('Reverter tentativa')
    expect(storage).toContain('<Confirm')
    expect(storage).not.toContain('window.confirm')
    expect(storage).not.toContain('forceCentralActive')
    expect(storage).not.toContain('setModuleState')
  })

  it('mantém em destaque a identidade atual Web/PWA e não a transforma em assinatura', () => {
    expect(source).toContain('Web/PWA continua incluído')
    expect(source).toContain('login, PWA e sincronização online')
  })

  it('deixa claro que o PC-servidor não concede privilégio administrativo', () => {
    expect(source).toContain('Estar fisicamente no PC-servidor não concede acesso administrativo')
    expect(source).toContain('Atualizar permissões Cloud')
  })
})
