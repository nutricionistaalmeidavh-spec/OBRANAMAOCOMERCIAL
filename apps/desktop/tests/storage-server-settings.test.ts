import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const page=fs.readFileSync(path.resolve(process.cwd(),'src/pages/SettingsPage.tsx'),'utf8')
const storage=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
const preload=fs.readFileSync(path.resolve(process.cwd(),'electron/preload.cjs'),'utf8')
const main=fs.readFileSync(path.resolve(process.cwd(),'electron/main.cjs'),'utf8')
const css=fs.readFileSync(path.resolve(process.cwd(),'src/modules/command-center/artisys-utilities.css'),'utf8')
const source=`${page}\n${storage}`

describe('configuração de dados e servidor',()=>{
  it('preserva local/LAN e oficializa remote sem remover o padrão local',()=>{
    for(const text of ['Como sua empresa usa o Obra na Mão?','Somente neste computador — uso individual','Vários computadores — este é o computador principal','Vários computadores — conectar a esta empresa','Acesso remoto avançado — servidor próprio'])expect(source).toContain(text)
    expect(source).toContain('window.fluxoDre.storage.state()')
    expect(source).toContain('window.fluxoDre.storage.configure')
  })

  it('preserva discovery LAN, conexão manual, remote seguro e reconnect sem expor credenciais',()=>{
    for(const text of ['Encontrar a empresa nesta rede','Encontrar computador principal','Endereço do computador principal','Verificar endereço','Reconectar','HTTP público é bloqueado','https://servidor.seudominio.com','10.66.0.1:4732'])expect(source).toContain(text)
    expect(source).toContain('window.fluxoDre.storage.discoverServers()')
    expect(source).toContain('window.fluxoDre.storage.probeAddress')
    expect(source).toContain('window.fluxoDre.storage.connectAddress')
    expect(source).toContain('window.fluxoDre.lan.reconnect()')
    expect(source).not.toContain('deviceToken')
    expect(source).not.toContain('serverToken')
  })

  it('mantém a garantia explícita de ausência de fallback local silencioso',()=>{
    expect(storage).toContain('Se a conexão falhar, seus dados ficam protegidos')
    expect(storage).toContain('preserva a configuração atual')
    expect(storage).toContain('não troca de fonte de dados sozinho')
    expect(storage).not.toContain("host:effectiveHost||'127.0.0.1'")
  })

  it('orquestra todos os módulos automaticamente pela API de migração existente',()=>{
    expect(preload).toContain("call('storage:module-state'")
    expect(main).toContain("ipcMain.handle('storage:module-state'")
    expect(storage).toContain("const MODULE_ORDER:ModuleKey[]=['core','operation','planning','finance','rh','documents']")
    expect(storage).toContain('centralizeAll')
    expect(storage).toContain('migrationPreflight')
    expect(storage).toContain('migrateModule')
    expect(storage).toContain('Configurar uso compartilhado')
    expect(storage).toContain('central-active')
    expect(storage).not.toContain('Migrar para servidor')
  })

  it('centraliza o estado transitório do setup em reducer em vez de hooks independentes',()=>{
    expect(storage).toContain('useReducer(setupUiReducer,initialSetupUiState)')
    expect(storage).toContain("type SetupStage='idle'|'saving'|'checking'|'authorizing'|'backup'|'migrating'|'validating'|'waiting'|'ready'|'error'")
    expect(storage).toContain("dispatchSetupUi({type:'progress',value})")
    expect(storage).not.toContain('const [busy,setBusy]=useState')
    expect(storage).not.toContain('const [progress,setProgress]=useState')
    expect(storage).not.toContain('const [discovering,setDiscovering]=useState')
  })

  it('mantém a máquina de estados e recovery nos detalhes técnicos',()=>{
    expect(storage).toContain('Avançado e diagnóstico')
    expect(storage).toContain('storage-module-list')
    expect(storage).toContain('storage-progress-panel')
    expect(storage).toContain('<progress')
    expect(storage).toContain('Tentar novamente')
    expect(storage).toContain('rollbackModuleMigration')
    expect(storage).toContain('Reverter tentativa')
    expect(storage).toContain('<Confirm')
    expect(storage).not.toContain('window.confirm')
    expect(storage).not.toContain('forceCentralActive')
    expect(storage).not.toContain('setModuleState')
  })

  it('expõe operação administrativa e backup sem transformar o PC servidor em autoridade',()=>{
    expect(storage).toContain('Operação do servidor')
    expect(storage).toContain('Criar backup agora')
    expect(storage).toContain('Criar backup pré-upgrade')
    expect(storage).toContain('Testar restore')
    expect(preload).toContain('operationsStatus')
    expect(preload).toContain('listBackups')
    expect(source).toContain('Estar fisicamente no PC-servidor não concede acesso administrativo')
    expect(source).toContain('Atualizar permissões Cloud')
  })

  it('responde à largura real do card e não ao viewport global',()=>{
    expect(css).toContain('container-type:inline-size')
    expect(css).toContain('@container (max-width:760px)')
    expect(css).toContain('@container (max-width:620px)')
    expect(css).not.toContain('@media(max-width:1180px){\n  .storage-setup-body')
  })

  it('mantém os cards de configurações com altura baseada no conteúdo',()=>{
    expect(css).not.toContain('.route-configuracoes .setting-card{position:relative;min-height:190px')
    expect(css).toContain('.route-configuracoes .setting-card{position:relative;grid-column:span 4;min-width:0;min-height:0')
  })

  it('mantém Web/PWA independente da fonte operacional',()=>{
    expect(source).toContain('Acesso Web/PWA continua disponível')
    expect(source).toContain('onde ficam os dados operacionais do Desktop')
  })
})
