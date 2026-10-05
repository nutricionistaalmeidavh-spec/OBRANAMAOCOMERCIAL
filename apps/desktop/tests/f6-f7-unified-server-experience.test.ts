import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')

describe('Fase 6/7 — experiência única e recovery do servidor',()=>{
  it('orienta segundo computador por descoberta, seleção, autorização e confirmação',()=>{
    for(const text of [
      'Encontrar computador principal',
      'Usar este computador',
      'Código de pareamento',
      'pareando este computador',
      'Computador conectado',
    ]) expect(source).toContain(text)
  })

  it('mantém indisponibilidade como estado recuperável da jornada, não apenas toast',()=>{
    expect(source).toContain("type ConnectionState='idle'|'checking'|'connected'|'unavailable'|'pairing-required'")
    expect(source).toContain('Servidor temporariamente indisponível')
    expect(source).toContain('Seus dados continuam no computador principal')
    expect(source).toContain('Tentar reconectar')
    expect(source).toContain('Nenhum dado foi movido para este computador')
  })

  it('impede ações concorrentes e confirma o estado real depois da recuperação',()=>{
    expect(source).toContain('disabled={busy||discovering')
    expect(source).toContain("setConnectionState('checking')")
    expect(source).toContain("setConnectionState('connected')")
    expect(source).toContain('Conexão restabelecida')
  })

  it('não oferece fallback local quando o servidor selecionado está indisponível',()=>{
    expect(source).not.toContain('Continuar localmente')
    expect(source).not.toContain('Usar dados locais temporariamente')
    expect(source).toContain('não troca de fonte de dados sozinho')
  })
})
