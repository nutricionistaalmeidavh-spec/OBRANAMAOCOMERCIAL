import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('ArtiSys commercial desktop redesign contract',()=>{
  it('loads the web-derived ArtiSys desktop skin after command center styles',()=>{
    const app=read('../src/App.tsx')
    expect(app).toContain("./modules/command-center/artisys-desktop.css")
  })

  it('uses the same core visual tokens as the commercial web product',()=>{
    const css=read('../src/modules/command-center/artisys-desktop.css')
    for(const token of ['#071a46','#0b59f5','#0bb8f0','#101936','#f5f7fc'])expect(css).toContain(token)
    expect(css).toContain('.command-sidebar')
    expect(css).toContain('.artisys-topbar')
    expect(css).toContain('.command-kpi')
    expect(css).toContain('.data-table')
  })

  it('brands the desktop shell as ArtiSys while preserving the complete navigation map',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    expect(shell).toContain('ArtiSys')
    expect(shell).toContain('artisys-brand')
    expect(shell).toContain('artisys-topbar')
    for(const route of ['/', '/assistente-ia', '/dre', '/financeiro', '/folha', '/obras', '/frentes', '/orcamento', '/planejamento', '/rdo', '/medicoes', '/compras', '/contratos', '/tarefas', '/rh', '/funcionarios', '/registro-funcionario', '/ponto', '/rh/modelos', '/documentos', '/cadastros', '/importacao', '/configuracoes'])expect(shell).toContain(`'${route}'`)
  })

  it('keeps the classic layout available as a compatibility fallback',()=>{
    const settings=read('../src/pages/SettingsPage.tsx')
    expect(settings).toContain("changeLayout('classic')")
    expect(settings).toContain("changeLayout('command-center')")
  })
})
