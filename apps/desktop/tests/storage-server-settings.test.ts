import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const page = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/SettingsPage.tsx'), 'utf8')
const storage = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StorageServerSettings.tsx'), 'utf8')
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

  it('explicita o escopo centralizado atual sem fingir que todos os módulos já migraram', () => {
    expect(source).toContain('Empresas, Clientes e Obras já usam o servidor')
    expect(source).toContain('RDO, Planejamento, Financeiro, RH e demais módulos permanecem no comportamento atual')
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
