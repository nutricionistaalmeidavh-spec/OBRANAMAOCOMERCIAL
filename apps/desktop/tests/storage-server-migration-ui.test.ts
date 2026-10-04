import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('StorageServerSettings migration UI contract',()=>{
  it('apresenta uma única jornada de configuração com progresso',()=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
    expect(source).toContain('Computadores e acesso')
    expect(source).toContain('Configurar servidor e migrar dados')
    expect(source).toContain('storage-progress-panel')
    expect(source).toContain('<progress')
    expect(source).toContain('5 de 5 etapas concluídas')
    expect(source).toContain('Dados centralizados')
  })

  it('mantém estados por módulo apenas em detalhes técnicos',()=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
    expect(source).toContain('Detalhes técnicos')
    for(const label of ['Cadastros-base','RDO / operação','Planejamento','Financeiro','RH']) expect(source).toContain(label)
    expect(source).toContain('storage-module-list')
    expect(source).not.toContain('Migrar para servidor')
  })

  it('preserva backup, dados locais e recovery sem confirmação nativa',()=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
    expect(source).toMatch(/backup/i)
    expect(source).toMatch(/dados locais/i)
    expect(source).toContain('Tentar novamente')
    expect(source).toContain('Reverter tentativa')
    expect(source).not.toContain('window.confirm')
  })
})
