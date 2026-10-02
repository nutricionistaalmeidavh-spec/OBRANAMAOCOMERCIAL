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

  it('permite host/porta, teste de conexão, claim e pareamento sem expor credenciais', () => {
    expect(source).toContain('Endereço do servidor')
    expect(source).toContain('Porta')
    expect(source).toContain('Testar servidor')
    expect(source).toContain('Encontrar servidor automaticamente')
    expect(source).toContain('Conectar manualmente')
    expect(source).toContain('Procurar na rede')
    expect(source).toContain('Testar conexão')
    expect(source).toContain('window.fluxoDre.storage.testConnection()')
    expect(source).toContain('window.fluxoDre.storage.discoverServers()')
    expect(source).toContain('window.fluxoDre.storage.probeAddress')
    expect(source).toContain('window.fluxoDre.storage.connectAddress')
    expect(source).toContain('window.fluxoDre.lan.claimHost')
    expect(source).toContain('window.fluxoDre.lan.pair')
    expect(source).toContain('window.fluxoDre.lan.reconnect()')
    expect(source).toContain('Reconectar servidor')
    expect(source).toContain('Nenhum outro servidor foi usado como substituto')
    expect(source).not.toContain('deviceToken')
    expect(source).not.toContain('serverToken')
  })

  it('não transforma falha de conexão em localhost/fallback silencioso', () => {
    expect(storage).toContain('applyServerConnection')
    expect(storage).toContain('connectAddress(address)')
    expect(storage).toContain('a configuração atual é preservada')
    expect(storage).toContain('não existe fallback local silencioso')
    expect(storage).not.toContain("host:effectiveHost||'127.0.0.1'")
  })

  it('expõe operação e os demais módulos pelo contrato genérico sem centralização silenciosa', () => {
    expect(preload).toContain("call('storage:module-state'")
    expect(main).toContain("ipcMain.handle('storage:module-state'")
    expect(storage).toContain("const keys:ModuleKey[]=['core','operation','planning','finance','rh']")
    expect(storage).toContain('storageApi.moduleState(key)')
    expect(storage).toContain("operation:'RDO / operação'")
    expect(storage).toContain("planning:'Planejamento'")
    expect(storage).toContain("finance:'Financeiro'")
    expect(storage).toContain("rh:'RH'")
    expect(storage).toContain('Migração necessária')
    expect(storage).toContain('Os dados locais permanecem neste computador')
    expect(storage).toContain('Banco central ativo')
  })

  it('expõe a cadeia real de dependências e bloqueia módulos posteriores até o anterior estar central', () => {
    expect(storage).toContain('dependencyBlockedBy')
    expect(storage).toContain('blockedBy')
    expect(storage).toContain('Conclua a migração/ativação desse bloco')
    expect(storage).toContain('Cadastros-base → RDO/operação → Planejamento → Financeiro → RH')
    expect(storage).toContain("state?.state==='central-ready'&&blockedBy")
    expect(storage).toContain('Não haverá fallback local silencioso')
  })

  it('mantém retry/rollback explícitos em vez de ativação forçada', () => {
    expect(storage).toContain('migrationStatus')
    expect(storage).toContain('Tentar novamente')
    expect(storage).toContain('rollbackModuleMigration')
    expect(storage).toContain('Reverter tentativa')
    expect(storage).not.toContain('forceCentralActive')
    expect(storage).not.toContain('setModuleState')
  })

  it('mantém em destaque a identidade atual Web/PWA e não a transforma em assinatura', () => {
    expect(source).toContain('Web/PWA continua incluído')
    expect(source).toContain('Login, PWA e a sincronização online')
    expect(source).toContain('não são substituídos nem passam a exigir assinatura')
  })

  it('deixa claro que o PC-servidor não concede privilégio administrativo', () => {
    expect(source).toContain('Estar fisicamente no PC-servidor não concede acesso administrativo')
    expect(source).toContain('Atualizar permissões Cloud')
  })
})
