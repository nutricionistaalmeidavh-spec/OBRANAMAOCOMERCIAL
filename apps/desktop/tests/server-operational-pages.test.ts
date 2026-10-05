import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const fronts=fs.readFileSync(path.resolve(process.cwd(),'src/pages/FrontsPage.tsx'),'utf8')
const rdo=fs.readFileSync(path.resolve(process.cwd(),'src/pages/DailyReportPage.tsx'),'utf8')

describe('operational pages in server mode',()=>{
  it('opens central fronts without reading local subfront/checklist ids',()=>{
    expect(fronts).toContain("window.fluxoDre.storage.moduleState('operation')")
    expect(fronts).toContain("operationStorage.data?.state === 'central-active'")
    expect(fronts).toContain('selectedFront && !serverOperation')
    expect(fronts).toContain('Subfrentes e checklist ainda não possuem fonte central canônica')
  })

  it('allows central RDO while guarding local-only attachments and RH identity',()=>{
    expect(rdo).toContain("window.fluxoDre.storage.moduleState('operation')")
    expect(rdo).toContain("window.fluxoDre.storage.moduleState('rh')")
    expect(rdo).toContain('disabled={serverMode}')
    expect(rdo).toContain('Anexos ainda usam a fonte local')
    expect(rdo).toContain('rhActive ? window.fluxoDre.funcionarios.list() : Promise.resolve([])')
  })
})
