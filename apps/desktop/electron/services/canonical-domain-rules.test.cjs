const { describe, it, expect } = require('vitest')
const rules = require('../../../packages/domain-core/business-rules.cjs')

describe('canonical domain business rules', () => {
  it('calculates payroll net amount once', () => {
    expect(rules.payrollNetAmount([
      { natureza: 'credito', valor_centavos: 120000 },
      { natureza: 'credito', valor_centavos: 30000 },
      { natureza: 'desconto', valor_centavos: 25000 }
    ])).toBe(125000)
  })

  it('builds cumulative planning curve once', () => {
    expect(rules.buildPlanningCurve([
      { id: 1, nome: 'A', previsto_fim: '2026-10-01', custo_planejado_centavos: 100, custo_realizado_centavos: 80, percentual_previsto: 50, percentual_realizado: 40 },
      { id: 2, nome: 'B', previsto_fim: '2026-10-02', custo_planejado_centavos: 200, custo_realizado_centavos: 120, percentual_previsto: 100, percentual_realizado: 90 }
    ])).toEqual([
      { etapa_id: 1, nome: 'A', data: '2026-10-01', previsto_centavos: 100, realizado_centavos: 80, percentual_previsto: 50, percentual_realizado: 40 },
      { etapa_id: 2, nome: 'B', data: '2026-10-02', previsto_centavos: 300, realizado_centavos: 200, percentual_previsto: 100, percentual_realizado: 90 }
    ])
  })

  it('builds accumulated cash flow once', () => {
    expect(rules.buildAccumulatedCashflow([
      { competencia: '2026-09', tipo: 'receber', valor: 500 },
      { competencia: '2026-09', tipo: 'pagar', valor: 200 },
      { competencia: '2026-10', tipo: 'pagar', valor: 100 }
    ])).toEqual([
      { competencia: '2026-09', receber_centavos: 500, pagar_centavos: 200, saldo_centavos: 300, acumulado_centavos: 300 },
      { competencia: '2026-10', receber_centavos: 0, pagar_centavos: 100, saldo_centavos: -100, acumulado_centavos: 200 }
    ])
  })

  it('derives an RDO task once', () => {
    expect(rules.rdoTaskFromOccurrence({
      obra_id: 7, frente_id: 3, data: '2026-10-05'
    }, { id: 9 }, {
      tipo: 'Atraso', descricao: 'Material não chegou', prioridade: 'alta', status: 'em_andamento'
    })).toMatchObject({
      obra_id: 7, frente_id: 3, rdo_ocorrencia_id: 9, origem_tipo: 'rdo_ocorrencia',
      origem_id: 9, titulo: 'Atraso: Material não chegou', prioridade: 'alta', status: 'em_andamento'
    })
  })

  it('derives finance payment status once', () => {
    expect(rules.financePaymentStatus({ tipo: 'pagar', valor_centavos: 1000 }, 999)).toBe('parcialmente_pago')
    expect(rules.financePaymentStatus({ tipo: 'pagar', valor_centavos: 1000 }, 1000)).toBe('pago')
    expect(rules.financePaymentStatus({ tipo: 'receber', valor_centavos: 1000 }, 1000)).toBe('recebido')
  })
})
