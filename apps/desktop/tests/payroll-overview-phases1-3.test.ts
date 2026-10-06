import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('payroll overview phases 1-3',()=>{
  it('exposes the overview IPC contract locally and through the preload bridge',()=>{
    const main=read('../electron/main.cjs')
    const preload=read('../electron/preload.cjs')
    const source=read('../electron/services/rh-source-service.cjs')
    expect(main).toContain("'payroll:overview'")
    expect(preload).toContain("overview: (data) => call('payroll:overview', data)")
    expect(source).toContain('async overview(payload)')
  })

  it('makes Visão geral the first payroll tab and renders the spreadsheet matrix',()=>{
    const page=read('../src/pages/PayrollPage.tsx')
    expect(page).toContain("useState('overview')")
    expect(page).toContain("value:'overview',label:'Visão geral'")
    expect(page).toContain('payroll-overview-table')
    expect(page).toContain('Remuneração')
    expect(page).toContain('Benefícios')
    expect(page).toContain('Descontos')
    expect(page).toContain('Encargos')
    expect(page).toContain('Despesas da empresa')
    expect(page).toContain('TOTAL DA COMPETÊNCIA')
  })

  it('supports smart cells with drill-down source details',()=>{
    const page=read('../src/pages/PayrollPage.tsx')
    expect(page).toContain('openCellDetail')
    expect(page).toContain('payroll-overview-cell')
    expect(page).toContain('Origem do valor')
    expect(page).toContain('Abrir funcionário')
    expect(page).toContain('Abrir contas a pagar')
  })
})
