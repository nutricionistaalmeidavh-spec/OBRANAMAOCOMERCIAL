import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('payroll overview phases 9-10',()=>{
  it('routes Excel/PDF export through the canonical payroll source',()=>{
    const main=read('../electron/main.cjs')
    const preload=read('../electron/preload.cjs')
    const exporter=read('../electron/services/payroll-export-service.cjs')
    expect(main).toContain("new PayrollExportService({ payroll: rh, dialog })")
    expect(main).toContain("'payroll:export-overview'")
    expect(preload).toContain("exportOverview: (data) => call('payroll:export-overview'")
    expect(exporter).toContain('await this.payroll.overview({')
    expect(exporter).toContain("format === 'xlsx'")
    expect(exporter).toContain("return this.exportPdf(payload, overview)")
  })

  it('exposes explicit Excel and PDF actions in the overview without replacing import',()=>{
    const page=read('../src/pages/PayrollPage.tsx')
    expect(page).toContain("onClick={()=>exportOverview('xlsx')}")
    expect(page).toContain("onClick={()=>exportOverview('pdf')}")
    expect(page).toContain('Importar planilha')
    expect(page).toContain("empresa_nome:selectedCompany?.nome_fantasia")
    expect(page).toContain("obra_nome:selectedWork?.nome")
  })

  it('keeps export read-only and import guarded by preview/undo contracts',()=>{
    const exporter=read('../electron/services/payroll-export-service.cjs')
    const core=read('../../../packages/domain-core/index.cjs')
    expect(exporter).not.toContain('.db.')
    expect(exporter).not.toContain('INSERT INTO')
    expect(exporter).not.toContain('UPDATE ')
    expect(core).toContain('function createPayrollImportEngine')
    expect(core).toContain('canCommit:blockers.length===0')
    expect(core).toContain('function undo(importId)')
  })
})
