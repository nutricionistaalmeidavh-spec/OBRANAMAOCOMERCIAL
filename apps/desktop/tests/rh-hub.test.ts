import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('commercial RH navigation contract',()=>{
  it('defines canonical RH routes and preserves legacy aliases',()=>{
    const registry=read('../src/routes/registry.ts')
    for(const route of ['/rh/funcionarios','/rh/admissoes','/rh/remuneracao','/rh/folha','/rh/ponto','/rh/modelos'])expect(registry).toContain(route)
    for(const legacy of ['/funcionarios','/registro-funcionario','/folha','/ponto'])expect(registry).toContain(`from:'${legacy}'`)
    const app=read('../src/App.tsx')
    expect(app).toContain('LEGACY_ROUTE_ALIASES.map')
    expect(app).toContain('ROUTES.rhCompensation')
  })

  it('keeps the sidebar compact while the RH hub exposes the complete RH domain',()=>{
    const registry=read('../src/routes/registry.ts')
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    const hub=read('../src/pages/RhHubPage.tsx')
    expect(shell).toContain('COMMAND_NAVIGATION_GROUPS')
    expect(registry).toContain("label:'Pessoas & RH'")
    expect(registry).toContain('ROUTES.rhPayroll')
    for(const route of ['ROUTES.rhEmployees','ROUTES.rhAdmissions','ROUTES.rhCompensation','ROUTES.rhPayroll','ROUTES.rhTime','ROUTES.rhTemplates'])expect(hub).toContain(route)
  })

  it('makes compensation the canonical owner and keeps payroll as a consumer',()=>{
    const page=read('../src/pages/CompensationPage.tsx')
    expect(page).toContain('Cargos e remuneração')
    expect(page).toContain('Valores efetivos por cargo')
    expect(page).toContain('saveCompensationPolicy')
    expect(page).toContain('Valor padrão para novos cargos')
    expect(page).not.toContain('Valor sugerido')
  })

  it('shows the document center and collapsible monthly editor',()=>{
    const timeSheet=read('../src/pages/TimeSheetPage.tsx')
    expect(timeSheet).toContain('Documentos da competência')
    expect(timeSheet).toContain('Editar marcações do mês')
    expect(timeSheet).toContain('Reimprimir')
  })
})
