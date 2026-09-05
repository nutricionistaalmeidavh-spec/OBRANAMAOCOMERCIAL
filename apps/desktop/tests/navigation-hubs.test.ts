import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('desktop navigation hubs',()=>{
  it('reorganizes the command center without removing legacy destination routes',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    for(const label of ['Financeiro','Obras','Pessoas & RH','Configuracoes'])expect(shell).toContain(label)
    for(const route of ['/dre','/financeiro','/orcamento','/medicoes','/compras-contratos','/obras','/frentes','/planejamento','/rdo','/tarefas','/rh','/folha','/configuracoes'])expect(shell).toContain(`'${route}'`)
  })

  it('uses the global AI entry while preserving the full assistant route',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    const app=read('../src/App.tsx')
    expect(shell).toContain('GlobalAiAssistant')
    expect(shell).not.toContain("{ to: '/assistente-ia'")
    expect(app).toContain('path="/assistente-ia"')
  })

  it('adds the purchases and contracts hub while preserving its three existing destinations',()=>{
    const hub=read('../src/pages/ProcurementContractsHubPage.tsx')
    expect(hub).toContain('Compras e Contratos')
    expect(hub).toContain("to:'/compras'")
    expect(hub).toContain("to:'/contratos'")
    expect(hub).toContain("to:'/cadastros'")
  })

  it('turns Configuracoes into a hub without losing documents, import or system settings',()=>{
    const hub=read('../src/pages/SettingsHubPage.tsx')
    const app=read('../src/App.tsx')
    expect(hub).toContain("to:'/documentos'")
    expect(hub).toContain("to:'/importacao'")
    expect(hub).toContain("to:'/configuracoes/sistema'")
    for(const route of ['/documentos','/importacao','/configuracoes','/configuracoes/sistema'])expect(app).toContain(`path="${route}"`)
  })

  it('keeps direct legacy module routes registered for bookmarks and internal links',()=>{
    const app=read('../src/App.tsx')
    for(const route of ['/compras','/contratos','/cadastros','/orcamento','/medicoes','/folha'])expect(app).toContain(`path="${route}"`)
  })
})
