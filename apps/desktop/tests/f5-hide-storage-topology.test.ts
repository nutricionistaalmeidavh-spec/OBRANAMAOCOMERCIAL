import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const pages=['WorkDetailPage.tsx','WorksPage.tsx','FrontsPage.tsx','DailyReportPage.tsx']
const technical=/central-active|central-ready|migration-required|centralizad[oa]|migra(?:ção|r)/i

describe('Fase 5 — topologia técnica não vaza para a jornada operacional',()=>{
  it.each(pages)('%s não ensina estados internos ao usuário',page=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'src/pages',page),'utf8')
    const userFacing=source.replace(/\.state\s*===\s*['"]central-active['"]/g,'')
    expect(userFacing).not.toMatch(technical)
  })

  it('mantém indisponibilidade orientada a impacto e próxima ação',()=>{
    const work=fs.readFileSync(path.resolve(process.cwd(),'src/pages/WorkDetailPage.tsx'),'utf8')
    const fronts=fs.readFileSync(path.resolve(process.cwd(),'src/pages/FrontsPage.tsx'),'utf8')
    const rdo=fs.readFileSync(path.resolve(process.cwd(),'src/pages/DailyReportPage.tsx'),'utf8')
    expect(work).toContain('Finalize a configuração do uso compartilhado em Configurações')
    expect(fronts).toContain('Finalize a configuração do uso compartilhado em Configurações')
    expect(rdo).toContain('Finalize a configuração do uso compartilhado em Configurações')
  })

  it('mantém os estados técnicos no diagnóstico, onde são úteis',()=>{
    const settings=fs.readFileSync(path.resolve(process.cwd(),'src/components/StorageServerSettings.tsx'),'utf8')
    expect(settings).toContain('Avançado e diagnóstico')
    for(const state of ['migration-required','central-ready','central-active'])expect(settings).toContain(state)
  })
})
