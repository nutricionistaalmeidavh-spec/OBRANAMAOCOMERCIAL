import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/SettingsPage.tsx'), 'utf8')

describe('configuracao de dados e servidor', () => {
  it('expoe o modo local e o modo servidor sem remover o padrao local', () => {
    expect(source).toContain('Dados e servidor')
    expect(source).toContain('Neste computador')
    expect(source).toContain('Servidor da empresa')
    expect(source).toContain('window.fluxoDre.storage.state()')
    expect(source).toContain('window.fluxoDre.storage.configure')
  })

  it('permite informar host, porta e testar a conexao LAN', () => {
    expect(source).toContain('Endereço do servidor')
    expect(source).toContain('Porta')
    expect(source).toContain('Testar conexão')
    expect(source).toContain('window.fluxoDre.storage.testConnection()')
  })

  it('informa quais cadastros ja usam o servidor e preserva os demais como locais', () => {
    expect(source).toContain('Empresas, clientes e obras usam o servidor')
    expect(source).toContain('Os demais módulos continuam usando os dados locais')
    expect(source).not.toContain('os cadastros existentes ainda continuam locais')
    expect(source).not.toContain('o CRUD remoto será habilitado gradualmente nas próximas fases')
  })

  it('deixa explicito que Web/PWA continua incluído e independente do armazenamento operacional', () => {
    expect(source).toContain('Web/PWA continua independente desta configuração')
    expect(source).toContain('Empresas, clientes e obras usam o servidor')
  })
})
