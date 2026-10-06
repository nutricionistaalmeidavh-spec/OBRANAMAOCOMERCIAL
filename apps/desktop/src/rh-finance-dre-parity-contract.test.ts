import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read=(file:string)=>fs.readFileSync(path.resolve(import.meta.dirname,file),'utf8')

describe('RH → Financeiro → DRE parity UX',()=>{
  it('RH distinguishes effective base salary from monthly payroll',()=>{
    const source=read('pages/EmployeesPage.tsx')
    expect(source).toContain('Salário-base efetivo')
    expect(source).toContain('Salários-base efetivos')
    expect(source).toContain('Definido pelo cargo')
    expect(source).not.toContain('Folha-base')
  })

  it('Financeiro distinguishes obligation from cash realization',()=>{
    const source=read('modules/command-center/FinancePage.tsx')
    expect(source).toContain('Total previsto na competência')
    expect(source).toContain('Pago')
    expect(source).toContain('Em aberto')
  })

  it('DRE exposes competência and realizado side by side',()=>{
    const source=read('modules/command-center/DrePage.tsx')
    expect(source).toContain('Competência')
    expect(source).toContain('Realizado')
    expect(source).toContain('valor_realizado')
  })

  it('RH company expenses tab shows actual competence expenses before navigation',()=>{
    const source=read('pages/PayrollPage.tsx')
    expect(source).toContain('Despesas e encargos da competência')
    expect(source).toContain('Abrir contas a pagar')
    expect(source).toContain('Abrir DRE')
  })
})
