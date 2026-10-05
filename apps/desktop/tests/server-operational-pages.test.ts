import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const fronts=fs.readFileSync(path.resolve(process.cwd(),'src/pages/FrontsPage.tsx'),'utf8')
const rdo=fs.readFileSync(path.resolve(process.cwd(),'src/pages/DailyReportPage.tsx'),'utf8')
const measurements=fs.readFileSync(path.resolve(process.cwd(),'src/pages/MeasurementsPage.tsx'),'utf8')
const procurement=fs.readFileSync(path.resolve(process.cwd(),'src/pages/ProcurementPage.tsx'),'utf8')
const contracts=fs.readFileSync(path.resolve(process.cwd(),'src/pages/ContractsPage.tsx'),'utf8')

describe('operational pages in server mode',()=>{
  it('libera frentes, subfrentes e checklist apenas quando Operação está central-active',()=>{
    expect(fronts).toContain("window.fluxoDre.storage.moduleState('operation')")
    expect(fronts).toContain("operationStorage.data?.state === 'central-active'")
    expect(fronts).toContain("operationActive && selectedFront ? window.fluxoDre.subfrentes.list")
    expect(fronts).toContain("operationActive && selectedFront ? window.fluxoDre.checklistFrente.list")
    expect(fronts).not.toContain('Protegido no modo servidor')
    expect(fronts).not.toContain('Subfrentes e checklist ainda não possuem fonte central canônica')
  })

  it('allows central RDO while guarding local-only attachments and RH identity',()=>{
    expect(rdo).toContain("window.fluxoDre.storage.moduleState('operation')")
    expect(rdo).toContain("window.fluxoDre.storage.moduleState('rh')")
    expect(rdo).toContain('disabled={serverMode}')
    expect(rdo).toContain('Anexos ainda usam a fonte local')
    expect(rdo).toContain('rhActive ? window.fluxoDre.funcionarios.list() : Promise.resolve([])')
  })

  it('mantém anexos locais protegidos até a Fase 6 sem bloquear medições, compras e contratos centrais',()=>{
    for(const source of [measurements,procurement,contracts]){
      expect(source).toContain("window.fluxoDre.storage.state()")
      expect(source).toContain("const serverMode = storage.data?.mode === 'server'")
      expect(source).toContain('Anexos serão liberados na Fase 6 de documentos compartilhados')
    }
  })
})
