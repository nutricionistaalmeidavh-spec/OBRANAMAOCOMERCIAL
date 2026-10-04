import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const page=fs.readFileSync(path.resolve(process.cwd(),'src/pages/SettingsPage.tsx'),'utf8')
const storage=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
const preload=fs.readFileSync(path.resolve(process.cwd(),'electron/preload.cjs'),'utf8')
const main=fs.readFileSync(path.resolve(process.cwd(),'electron/main.cjs'),'utf8')
const source=`${page}\n${storage}`

describe('configuração de dados e servidor',()=>{
  it('preserva local/LAN e oficializa remote sem remover o padrão local',()=>{
    for(const text of ['Computadores e acesso','Somente neste computador','Usar em outros computadores nesta rede','Conectar este computador a uma instalação existente','Servidor remoto próprio / VPS'])expect(source).toContain(text)
    expect(source).toContain('window.fluxoDre.storage.state()')
    expect(source).toContain('window.fluxoDre.storage.configure')
  })

  it('preserva discovery LAN, conexão manual, remote seguro e reconnect sem expor credenciais',()=>{
    for(const text of ['Encontrar servidor automaticamente','Procurar na rede','Endereço do servidor','Testar conexão','Reconectar servidor','HTTP público é bloqueado','https://servidor.seudominio.com','10.66.0.1:4732'])expect(source).toContain(text)
    expect(source).toContain('window.fluxoDre.storage.discoverServers()')
    expect(source).toContain('window.fluxoDre.storage.probeAddress')
    expect(source).toContain('window.fluxoDre.storage.connectAddress')
    expect(source).toContain('window.fluxoDre.lan.reconnect()')
    expect(source).not.toContain('deviceToken')
    expect(source).not.toContain('serverToken')
  })

  it('prioriza descoberta automática para PCs e mantém QR fora do pareamento obrigatório de computador',()=>{
    expect(source).toContain('Computadores e acesso')
    expect(source).toContain('Como você quer usar o Obra na Mão?')
    expect(source).toContain('Usar em outros computadores nesta rede')
    expect(source).toContain('Outro computador não precisa de QR Code')
    expect(source).toContain('Configuração avançada')
    expect(storage).toContain("if(mode==='lan-client')void discoverServers()")
    expect(storage).toContain('Porta da rede local')
  })

  it('oferece liberação assistida e restrita do firewall para o computador principal',()=>{
    expect(preload).toContain("call('lan:firewall-state')")
    expect(preload).toContain("call('lan:enable-local-access')")
    expect(main).toContain("ipcMain.handle('lan:firewall-state'")
    expect(main).toContain("ipcMain.handle('lan:enable-local-access'")
    expect(storage).toContain('Liberar acesso nesta rede')
    expect(storage).toContain('Somente rede local privada')
  })

  it('mantém a garantia explícita de ausência de fallback local silencioso',()=>{
    expect(storage).toContain('Sem fallback silencioso')
    expect(storage).toContain('a configuração anterior é preservada')
    expect(storage).toContain('não troca para SQLite local automaticamente')
    expect(storage).not.toContain("host:effectiveHost||'127.0.0.1'")
  })

  it('orquestra todos os módulos automaticamente pela API de migração existente',()=>{
    expect(preload).toContain("call('storage:module-state'")
    expect(main).toContain("ipcMain.handle('storage:module-state'")
    expect(storage).toContain("const MODULE_ORDER:ModuleKey[]=['core','operation','planning','finance','rh']")
    expect(storage).toContain('centralizeAll')
    expect(storage).toContain('migrationPreflight')
    expect(storage).toContain('migrateModule')
    expect(storage).toContain('Configurar servidor e migrar dados')
    expect(storage).toContain('central-active')
    expect(storage).not.toContain('Migrar para servidor')
  })

  it('mantém a máquina de estados e recovery nos detalhes técnicos',()=>{
    expect(storage).toContain('Detalhes técnicos')
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

  it('mantém Web/PWA independente da fonte operacional',()=>{
    expect(source).toContain('Web/PWA continua incluído')
    expect(source).toContain('login, PWA e sincronização online')
  })
})
