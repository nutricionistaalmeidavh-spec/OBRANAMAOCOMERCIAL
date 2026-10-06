import { describe, expect, it } from 'vitest'
import employeesSource from './pages/EmployeesPage.tsx?raw'
import payrollValuesSource from './utils/payroll-values.ts?raw'
import financeSource from './modules/command-center/FinancePage.tsx?raw'
import dreSource from './modules/command-center/DrePage.tsx?raw'
import payrollSource from './pages/PayrollPage.tsx?raw'
import commandCenterCss from './modules/command-center/command-center.css?raw'

describe('RH → Financeiro → DRE parity UX',()=>{
  it('RH distinguishes effective base salary from monthly payroll',()=>{
    expect(employeesSource).toContain('Salário-base efetivo')
    expect(employeesSource).toContain('Salários-base efetivos')
    expect(payrollValuesSource).toContain('Definido pelo cargo')
    expect(employeesSource).not.toContain('Folha-base')
  })

  it('Financeiro distinguishes obligation from cash realization',()=>{
    expect(financeSource).toContain('Total previsto na competência')
    expect(financeSource).toContain('Pago')
    expect(financeSource).toContain('Em aberto')
  })

  it('DRE exposes competência and realizado side by side without wrapping the third column',()=>{
    expect(dreSource).toContain('Competência')
    expect(dreSource).toContain('Realizado')
    expect(dreSource).toContain('valor_realizado')
    expect(commandCenterCss).toContain('.dre-command-body .dre-row { grid-template-columns: 1fr 180px 180px;')
  })

  it('RH company expenses tab shows actual competence expenses before navigation',()=>{
    expect(payrollSource).toContain('Despesas e encargos da competência')
    expect(payrollSource).toContain('Abrir contas a pagar')
    expect(payrollSource).toContain('Abrir DRE')
  })
})
