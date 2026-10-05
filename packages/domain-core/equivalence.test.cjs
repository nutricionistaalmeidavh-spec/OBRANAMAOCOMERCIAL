const test = require('node:test')
const assert = require('node:assert/strict')
const core = require('./index.cjs')

test('Local e Server compartilham exatamente o mesmo owner puro para regras extraídas', () => {
  const stages = [
    { id: 1, nome: 'Fundação', previsto_inicio: '2026-10-01', previsto_fim: '2026-10-05', custo_planejado_centavos: 120000, custo_realizado_centavos: 100000, percentual_previsto: 100, percentual_realizado: 90 },
    { id: 2, nome: 'Estrutura', previsto_inicio: '2026-10-06', previsto_fim: '2026-10-20', custo_planejado_centavos: 300000, custo_realizado_centavos: 80000, percentual_previsto: 40, percentual_realizado: 20 }
  ]
  const accounts = [
    { competencia: '2026-10', tipo: 'receber', valor: 500000 },
    { competencia: '2026-10', tipo: 'pagar', valor: 150000 },
    { competencia: '2026-11', tipo: 'pagar', valor: 50000 }
  ]
  assert.deepEqual(core.planningCurve(stages), core.planningCurve(structuredClone(stages)))
  assert.deepEqual(core.planningCash(accounts), core.planningCash(structuredClone(accounts)))
})

test('Folha, RDO e Financeiro são determinísticos para fixtures equivalentes', () => {
  const launches = [{ quinzena: 1, natureza: 'credito', valor_centavos: 10000 }, { quinzena: 1, natureza: 'desconto', valor_centavos: 1250 }]
  assert.equal(core.payrollAmount(launches), 8750)
  const data = { obra_id: 7, frente_id: 3, data: '2026-10-05' }
  const occurrence = { tipo: 'atraso', descricao: 'Material não chegou', status: 'aberta' }
  assert.deepEqual(core.rdoOccurrenceTask(occurrence, data, 12), core.rdoOccurrenceTask(structuredClone(occurrence), structuredClone(data), 12))
  assert.equal(core.paymentStatus({ tipo: 'pagar', valor_centavos: 10000 }, 4000), 'parcialmente_pago')
  assert.equal(core.paymentStatus({ tipo: 'pagar', valor_centavos: 10000 }, 10000), 'pago')
  assert.equal(core.paymentStatus({ tipo: 'receber', valor_centavos: 10000 }, 10000), 'recebido')
})
