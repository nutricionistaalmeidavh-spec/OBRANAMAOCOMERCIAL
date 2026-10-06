import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  PAYROLL_OVERVIEW_COLUMNS,
  payrollOverviewEmployeeRow,
  payrollOverviewCompanyExpenseRows,
  buildPayrollOverview
} = require('../../../packages/domain-core/index.cjs')

describe('payroll overview phase 0 contract', () => {
  it('keeps the spreadsheet projection backed by canonical payroll launches and payable accounts', () => {
    const employee = payrollOverviewEmployeeRow({
      employee: { id: 1, nome: 'Ana' },
      cargo: { id: 3, nome: 'Ajudante' },
      benefits: [{ id: 9, nome: 'Vale-alimentação', tipo: 'alimentacao' }],
      launches: [
        { id: 10, tipo: 'salario', descricao: 'Salário base', natureza: 'credito', valor_centavos: 200000, origem: 'cargo' },
        { id: 11, tipo: 'beneficio_9', descricao: 'Vale-alimentação', natureza: 'credito', valor_centavos: 30000, origem: 'cargo' },
        { id: 12, tipo: 'falta', descricao: 'Falta', natureza: 'desconto', valor_centavos: 10000, origem: 'variavel' },
        { id: 13, tipo: 'fgts', descricao: 'FGTS', natureza: 'credito', valor_centavos: 16000, origem: 'importacao' }
      ]
    })

    expect(PAYROLL_OVERVIEW_COLUMNS.some((column:any) => column.key === 'encargos.fgts')).toBe(true)
    expect(employee.total_funcionario_centavos).toBe(220000)
    expect(employee.custo_empresa_centavos).toBe(236000)
    expect(employee.sources['beneficios.alimentacao'][0].id).toBe(11)

    const expenses = payrollOverviewCompanyExpenseRows([
      { id: 20, tipo: 'pagar', descricao: 'Folha Ana', categoria_nome: 'Folha de pagamento', valor_centavos: 220000 },
      { id: 21, tipo: 'pagar', descricao: 'DAS Simples Nacional', categoria_nome: 'Impostos', valor_centavos: 50000 }
    ])
    expect(expenses.map((row:any) => row.id)).toEqual([21])

    const overview = buildPayrollOverview({
      competencia: '2026-10',
      employeeEntries: [{
        employee: { id: 1, nome: 'Ana' },
        cargo: { id: 3, nome: 'Ajudante' },
        launches: [
          { id: 10, tipo: 'salario', descricao: 'Salário base', natureza: 'credito', valor_centavos: 200000 },
          { id: 13, tipo: 'fgts', descricao: 'FGTS', natureza: 'credito', valor_centavos: 16000 }
        ]
      }],
      accounts: [{ id: 21, tipo: 'pagar', descricao: 'DAS Simples Nacional', categoria_nome: 'Impostos', valor_centavos: 50000 }]
    })

    expect(overview.contract_version).toBe(1)
    expect(overview.totals.custo_competencia_centavos).toBe(266000)
  })
})
