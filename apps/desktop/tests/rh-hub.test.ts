import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('commercial RH navigation contract',()=>{
  it('adds the RH hub without removing existing paths',()=>{
    const app=read('../src/App.tsx')
    expect(app).toContain('path="/rh"')
    expect(app).toContain('path="/funcionarios"')
    expect(app).toContain('path="/registro-funcionario"')
    expect(app).toContain('path="/ponto"')
    expect(app).toContain('path="/rh/modelos"')
  })

  it('keeps the sidebar compact while the RH hub exposes its direct destinations',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    const hub=read('../src/pages/RhHubPage.tsx')
    expect(shell).toContain("label: 'Pessoas & RH'")
    expect(shell).toContain("to: '/rh'")
    expect(shell).toContain("to: '/folha'")
    expect(hub).toContain("to:'/funcionarios'")
    expect(hub).toContain("to:'/registro-funcionario'")
    expect(hub).toContain("to:'/ponto'")
    expect(hub).toContain("to:'/rh/modelos'")
  })

  it('shows the document center and collapsible monthly editor',()=>{
    const timeSheet=read('../src/pages/TimeSheetPage.tsx')
    expect(timeSheet).toContain('Documentos da competência')
    expect(timeSheet).toContain('Editar marcações do mês')
    expect(timeSheet).toContain('Reimprimir')
  })
})
