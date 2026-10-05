function money(value) { return Number(value || 0) }

function payrollAmount(rows = []) {
  const credits = rows.filter(row => row.natureza === 'credito').reduce((sum, row) => sum + money(row.valor_centavos), 0)
  const discounts = rows.filter(row => row.natureza === 'desconto').reduce((sum, row) => sum + money(row.valor_centavos), 0)
  return Math.max(0, credits - discounts)
}

function payrollPendingRows({ employee, cargo, competencia, launches = [], payments = [] }) {
  const paid = new Set(payments.filter(item => item.status === 'pago').map(item => Number(item.quinzena)))
  const result = []
  for (const quinzena of [1, 2]) {
    if (paid.has(quinzena)) continue
    const rows = launches.filter(item => Number(item.quinzena) === quinzena)
    if (quinzena === 2 && !rows.length) continue
    result.push({
      funcionario_id: employee.id,
      funcionario_nome: employee.nome,
      cargo_nome: cargo?.nome || 'Sem cargo',
      competencia,
      quinzena,
      valor_centavos: payrollAmount(rows),
      status: 'pendente'
    })
  }
  return result
}

function planningCurve(stages = []) {
  let planned = 0
  let actual = 0
  return stages.map(stage => {
    planned += money(stage.custo_planejado_centavos)
    actual += money(stage.custo_realizado_centavos)
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

function planningCash(accounts = []) {
  const grouped = accounts.reduce((acc, row) => {
    const item = acc.get(row.competencia) || { competencia: row.competencia, receber_centavos: 0, pagar_centavos: 0 }
    item[row.tipo === 'receber' ? 'receber_centavos' : 'pagar_centavos'] += money(row.valor)
    acc.set(row.competencia, item)
    return acc
  }, new Map())
  let balance = 0
  return [...grouped.values()].sort((a,b) => a.competencia.localeCompare(b.competencia)).map(row => {
    const period = row.receber_centavos - row.pagar_centavos
    balance += period
    return { ...row, saldo_periodo_centavos: period, saldo_acumulado_centavos: balance }
  })
}

function rdoChildRows(rows = [], rdoId, defaultFrontId, kind) {
  return rows.map(row => {
    const base = { ...row, rdo_id: rdoId, frente_id: row.frente_id || defaultFrontId || null }
    if (kind === 'equipe') return { ...base, funcionario_id: row.funcionario_id || null, horas: money(row.horas), custo_centavos: money(row.custo_centavos) }
    if (kind === 'equipamentos') return { ...base, horas_uso: money(row.horas_uso), custo_centavos: money(row.custo_centavos) }
    return base
  })
}

function rdoOccurrenceTask(row, data, occurrenceId) {
  if (row.status === 'resolvida') return null
  return {
    obra_id: data.obra_id,
    frente_id: row.frente_id || data.frente_id || null,
    rdo_ocorrencia_id: occurrenceId,
    origem_tipo: 'rdo_ocorrencia',
    origem_id: occurrenceId,
    titulo: `${row.tipo || 'Ocorrencia'}: ${row.descricao}`.slice(0, 180),
    descricao: `Gerada pelo RDO de ${data.data}. ${row.descricao || ''}`.trim(),
    responsavel: row.responsavel || null,
    prazo: row.prazo || null,
    prioridade: row.prioridade || 'normal',
    status: row.status === 'em_andamento' ? 'em_andamento' : 'aberta'
  }
}

function paymentStatus(account, paid) {
  const total = money(account?.valor_centavos)
  const amount = money(paid)
  if (amount <= 0) return account?.status === 'vencido' ? 'vencido' : 'pendente'
  if (amount < total) return 'parcialmente_pago'
  return 'pago'
}

module.exports = { payrollAmount, payrollPendingRows, planningCurve, planningCash, rdoChildRows, rdoOccurrenceTask, paymentStatus }
