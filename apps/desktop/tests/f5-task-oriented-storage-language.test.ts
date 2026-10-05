import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const files=['src/pages/WorkDetailPage.tsx','src/pages/FrontsPage.tsx','src/pages/DailyReportPage.tsx']
const ui=files.map(file=>fs.readFileSync(path.resolve(process.cwd(),file),'utf8')).join('\n')
const userFacing=ui.replace(/\\.state\\s*===\\s*['\"]central-active['\"]/g,'')

describe('Fase 5 — linguagem orientada à tarefa',()=>{
  it('não expõe estados de implementação nas páginas de trabalho',()=>{
    for(const technical of ['central-active','migration-required','central-ready','ainda não centralizada','Ainda não centralizado','fonte canônica']) {
      expect(userFacing).not.toContain(technical)
    }
  })

  it('explica bloqueio como situação, impacto e próxima ação',()=>{
    expect(ui).toContain('Preparando o uso compartilhado')
    expect(ui).toContain('Finalize a configuração do uso compartilhado em Configurações')
    expect(ui).toContain('para liberar')
  })

  it('descreve RH indisponível sem exigir conhecimento da migração',()=>{
    expect(ui).toContain('Equipe cadastrada temporariamente indisponível')
    expect(ui).toContain('Você ainda pode registrar pessoas avulsas ou terceirizadas')
    expect(ui).not.toContain('módulo RH')
  })

  it('mantém termos técnicos permitidos apenas no diagnóstico da configuração',()=>{
    const settings=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
    expect(settings).toContain('Avançado e diagnóstico')
    expect(settings).toContain('migration-required')
    expect(settings).toContain('central-active')
  })
})
