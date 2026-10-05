const test = require('node:test')
const assert = require('node:assert/strict')
const {
  payrollAmount,
  payrollPendingRows,
  planningCurve,
  planningCash,
  rdoChildRows,
  rdoOccurrenceTask,
  paymentStatus
} = require('./index.cjs')

test('folha calcula líquido sem permitir resultado negativo', () => {
  assert.equal(payrollAmount([{ natureza: 'credito', valor_centavos: 10000 }, { natureza: 'desconto', valor_centavos: 2500 }]), 7500)
  assert.equal(payrollAmount([{ natureza: 'desconto', valor_centavos: 2500 }]), 0)
})

test('pendências da folha preservam regra da segunda quinzena', () => {
  const rows = payrollPendingRows({
    employee: { id: 1, nome: 'Ana' },
    cargo: { nome: 'Encanadora' },
    competencia: '2026-10',
    launches: [{ quinzena: 1, natureza: 'credito', valor_centavos: 1000 }],
    payments: []
  })
  assert.deepEqual(rows.map(row => row.quinzena), [1])
})

test('planejamento calcula curva e caixa acumulados deterministicamente', () => {
  assert.deepEqual(planningCurve([
    { id: 1, nome: 'A', previsto_fim: '2026-10-01', custo_planejado_centavos: 100, custo_realizado_centavos: 40, percentual_previsto: 50, percentual_realizado: 20 },
    { id: 2, nome: 'B', previsto_fim: '2026-10-02', custo_planejado_centavos: 200, custo_realizado_centavos: 60, percentual_previsto: 100, percentual_realizado: 50 }
  ]).map(x => [x.previsto_centavos, x.realizado_centavos]), [[100,40],[300,100]])
  assert.deepEqual(planningCash([
    { tipo: 'pagar', competencia: '2026-10', valor: 30 },
    { tipo: 'receber', competencia: '2026-10', valor: 100 },
    { tipo: 'pagar', competencia: '2026-11', valor: 20 }
  ]).map(x => [x.competencia,x.saldo_acumulado_centavos]), [['2026-10',70],['2026-11',50]])
})

test('RDO normaliza filhos e gera tarefa somente para ocorrência aberta', () => {
  assert.deepEqual(rdoChildRows([{ horas: '8', custo_centavos: '1200' }], 9, 3, 'equipe')[0], {
    horas: 8, custo_centavos: 1200, rdo_id: 9, frente_id: 3, funcionario_id: null
  })
  assert.equal(rdoOccurrenceTask({ status: 'resolvida' }, { obra_id: 1, data: '2026-10-05' }, 1), null)
  assert.match(rdoOccurrenceTask({ tipo: 'pendencia', descricao: 'Teste' }, { obra_id: 1, data: '2026-10-05' }, 7).titulo, /Teste/)
})

test('financeiro deriva status de pagamento por valor acumulado', () => {
  assert.equal(paymentStatus({ tipo: 'pagar', valor_centavos: 10000 }, 4000), 'parcialmente_pago')
  assert.equal(paymentStatus({ tipo: 'pagar', valor_centavos: 10000 }, 10000), 'pago')
  assert.equal(paymentStatus({ tipo: 'receber', valor_centavos: 10000 }, 10000), 'recebido')
})
