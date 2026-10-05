function payrollNetAmount(rows = []) {
  const credits = rows.filter(row => row.natureza === 'credito').reduce((sum, row) => sum + Number(row.valor_centavos || 0), 0)
  const discounts = rows.filter(row => row.natureza === 'desconto').reduce((sum, row) => sum + Number(row.valor_centavos || 0), 0)
  return Math.max(0, credits - discounts)
}

function buildPlanningCurve(stages = []) {
  let planned = 0
  let actual = 0
  return stages.map(stage => {
    planned += Number(stage.custo_planejado_centavos || 0)
    actual += Number(stage.custo_realizado_centavos || 0)
    return {
      etapa_id: stage.id,
      nome: stage.nome,
      data: stage.previsto_fim || stage.previsto_inicio,
      previsto_centavos: planned,
      realizado_centavos: actual,
      percentual_previsto: Number(stage.percentual_previsto),
      percentual_realizado: Number(stage.percentual_realizado)
    }
  })
}

function buildAccumulatedCashflow(accounts = []) {
  const grouped = accounts.reduce((acc, row) => {
    const item = acc.get(row.competencia) || { competencia: row.competencia, receber_centavos: 0, pagar_centavos: 0 }
    item[row.tipo === 'receber' ? 'receber_centavos' : 'pagar_centavos'] += Number(row.valor || row.valor_centavos || 0)
    acc.set(row.competencia, item)
    return acc
  }, new Map())
  let balance = 0
  return [...grouped.values()].sort((a, b) => String(a.competencia).localeCompare(String(b.competencia))).map(item => {
    const saldo = item.receber_centavos - item.pagar_centavos
    balance += saldo
    return { ...item, saldo_centavos: saldo, acumulado_centavos: balance }
  })
}

function rdoTaskFromOccurrence(rdo, occurrence, row) {
  if (row.status === 'resolvida') return null
  const frenteId = row.frente_id || rdo.frente_id || null
  return {
    obra_id: rdo.obra_id,
    frente_id: frenteId,
    rdo_ocorrencia_id: occurrence.id,
    origem_tipo: 'rdo_ocorrencia',
    origem_id: occurrence.id,
    titulo: `${row.tipo || 'Ocorrencia'}: ${row.descricao}`.slice(0, 180),
    descricao: `Gerada pelo RDO de ${rdo.data}. ${row.descricao || ''}`.trim(),
    responsavel: row.responsavel || null,
    prazo: row.prazo || null,
    prioridade: row.prioridade || 'normal',
    status: row.status === 'em_andamento' ? 'em_andamento' : 'aberta'
  }
}

function financePaymentStatus(account, paid) {
  return Number(paid || 0) >= Number(account.valor_centavos || 0)
    ? (account.tipo === 'pagar' ? 'pago' : 'recebido')
    : 'parcialmente_pago'
}

module.exports = {
  payrollNetAmount,
  buildPlanningCurve,
  buildAccumulatedCashflow,
  rdoTaskFromOccurrence,
  financePaymentStatus
}
