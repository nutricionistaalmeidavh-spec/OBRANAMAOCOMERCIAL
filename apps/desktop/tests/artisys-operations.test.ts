import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('ArtiSys desktop operations visual contract',()=>{
  it('loads the dedicated operations skin after the shared ArtiSys layers',()=>{
    const app=read('../src/App.tsx')
    expect(app).toContain("./modules/command-center/artisys-operations.css")
  })

  it('covers the operational surfaces used across the desktop',()=>{
    const css=read('../src/modules/command-center/artisys-operations.css')
    for(const selector of ['.filters','.work-cards','.work-card','.work-overview-kpis','.stage-list','.curve-bars','.measurement-grid-wrap','.rdo-section'])expect(css).toContain(selector)
  })

  it('keeps all operational destinations reachable from the Works hub',()=>{
    const works=read('../src/pages/WorksPage.tsx')
    for(const destination of ['/frentes?obra=', '/planejamento?obra=', '/rdo?obra=', '/obras/'])expect(works).toContain(destination)
    expect(works).toContain('window.fluxoDre.obras.overview')
    expect(works).toContain('window.fluxoDre.obras.importSpreadsheets')
  })

  it('keeps the 360 page and planning data contracts intact',()=>{
    const detail=read('../src/pages/WorkDetailPage.tsx')
    const schedule=read('../src/pages/SchedulePage.tsx')
    expect(detail).toContain('window.fluxoDre.obras.overview')
    expect(detail).toContain('work-overview-kpis')
    expect(schedule).toContain('window.fluxoDre.planejamento.overview')
    expect(schedule).toContain('curve-bars')
  })
})
