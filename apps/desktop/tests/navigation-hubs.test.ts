import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('desktop navigation hubs',()=>{
  it('centralizes navigation, breadcrumbs and aliases in the route registry',()=>{
    const registry=read('../src/routes/registry.ts')
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    for(const label of ['Financeiro','Obras','Pessoas & RH','Configuracoes'])expect(registry).toContain(label)
    for(const route of ['/dre','/financeiro','/orcamento','/medicoes','/compras-contratos','/obras','/frentes','/planejamento','/rdo','/tarefas','/rh','/rh/folha','/configuracoes'])expect(registry).toContain(route)
    expect(shell).toContain('COMMAND_NAVIGATION_GROUPS')
    expect(shell).toContain('routeMeta(location.pathname)')
    expect(shell).toContain('routeClassName(location.pathname)')
  })

  it('uses the global AI entry while preserving the full assistant route',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    const registry=read('../src/routes/registry.ts')
    expect(shell).toContain('GlobalAiAssistant')
    expect(registry).toContain("ai:'/assistente-ia'")
  })

  it('adds the purchases and contracts hub while preserving its three existing destinations',()=>{
    const hub=read('../src/pages/ProcurementContractsHubPage.tsx')
    expect(hub).toContain('Compras e Contratos')
    expect(hub).toContain("to:'/compras'")
    expect(hub).toContain("to:'/contratos'")
    expect(hub).toContain("to:'/cadastros'")
  })

  it('turns Configuracoes into a hub without retaining RH domain ownership',()=>{
    const hub=read('../src/pages/SettingsHubPage.tsx')
    const settings=read('../src/pages/SettingsPage.tsx')
    expect(hub).toContain('ROUTES.documents')
    expect(hub).toContain('ROUTES.import')
    expect(hub).toContain('ROUTES.systemSettings')
    expect(hub).not.toContain('cargos e benefícios')
    expect(settings).not.toContain('Cargos e valores fixos')
    expect(settings).not.toContain('Tipos de benefícios')
  })

  it('keeps direct legacy RH links as explicit redirects instead of duplicate screens',()=>{
    const registry=read('../src/routes/registry.ts')
    const app=read('../src/App.tsx')
    for(const route of ['/funcionarios','/registro-funcionario','/folha','/ponto'])expect(registry).toContain(`from:'${route}'`)
    expect(app).toContain('LEGACY_ROUTE_ALIASES.map')
    expect(app).toContain('<Navigate to={alias.to} replace/>')
  })
})
