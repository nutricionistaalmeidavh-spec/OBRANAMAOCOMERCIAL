function money(value) { return Number(value || 0) }

const PAYROLL_OVERVIEW_COLUMNS = Object.freeze([
  { key: 'remuneracao.salario', group: 'remuneracao', label: 'Salário' },
  { key: 'remuneracao.vale_adiantamento', group: 'remuneracao', label: 'Vale / adiantamento' },
  { key: 'remuneracao.diarias', group: 'remuneracao', label: 'Diárias' },
  { key: 'remuneracao.empreitas', group: 'remuneracao', label: 'Empreitas' },
  { key: 'remuneracao.outros', group: 'remuneracao', label: 'Outros' },
  { key: 'beneficios.alimentacao', group: 'beneficios', label: 'Alimentação' },
  { key: 'beneficios.transporte', group: 'beneficios', label: 'Transporte' },
  { key: 'beneficios.outros', group: 'beneficios', label: 'Outros' },
  { key: 'descontos.faltas', group: 'descontos', label: 'Faltas' },
  { key: 'descontos.outros', group: 'descontos', label: 'Outros descontos' },
  { key: 'encargos.inss', group: 'encargos', label: 'INSS' },
  { key: 'encargos.fgts', group: 'encargos', label: 'FGTS' },
  { key: 'encargos.outros', group: 'encargos', label: 'Outros encargos' }
])

function normalizeLabel(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function launchSource(row) {
  return {
    kind: 'folha_lancamento',
    id: row?.id ?? null,
    origem: row?.origem || null,
    importacao_linha_id: row?.importacao_linha_id ?? null
  }
}

function accountSource(row) {
  return {
    kind: 'conta',
    id: row?.id ?? null,
    origem: row?.origem_tipo || null,
    origem_id: row?.origem_id ?? null
  }
}

function benefitMap(benefits = []) {
  return new Map(benefits.map(item => [Number(item.id), item]))
}

function launchBenefit(launch, catalog) {
  const match = String(launch?.tipo || '').match(/^beneficio_(\d+)$/)
  if (match) return catalog.get(Number(match[1])) || null
  return null
}

function classifyPayrollOverviewLaunch(launch, catalog) {
  const tipo = normalizeLabel(launch?.tipo).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const descricao = normalizeLabel(launch?.descricao)
  const natureza = normalizeLabel(launch?.natureza)

  if (tipo === 'inss' || /\binss\b/.test(descricao)) return 'encargos.inss'
  if (tipo === 'fgts' || /\bfgts\b/.test(descricao)) return 'encargos.fgts'
  if (tipo.startsWith('encargo_') || tipo === 'seconci' || /\b(encargo patronal|seconci)\b/.test(descricao)) return 'encargos.outros'

  if (tipo === 'salario' || /^salario\b/.test(descricao)) return 'remuneracao.salario'
  if (['vale_salario','vale_adiantamento','adiantamento'].includes(tipo)) return 'remuneracao.vale_adiantamento'
  if (tipo === 'diaria' || /^diaria\b/.test(descricao)) return 'remuneracao.diarias'
  if (tipo === 'empreita' || /^empreita\b/.test(descricao)) return 'remuneracao.empreitas'

  const benefit = launchBenefit(launch, catalog)
  const benefitType = normalizeLabel(benefit?.tipo)
  const benefitName = normalizeLabel(benefit?.nome || launch?.descricao)
  if (benefit || (natureza !== 'desconto' && /(aliment|refeic|cafe|transp)/.test(benefitName))) {
    if (/(aliment|refeic|cafe)/.test(benefitType) || /(aliment|refeic|cafe)/.test(benefitName)) return 'beneficios.alimentacao'
    if (/transp/.test(benefitType) || /transp/.test(benefitName)) return 'beneficios.transporte'
    return 'beneficios.outros'
  }

  if (tipo === 'falta' || /\bfalta\b/.test(descricao)) return 'descontos.faltas'
  if (natureza === 'desconto') return 'descontos.outros'
  return 'remuneracao.outros'
}

function emptyPayrollOverviewValues() {
  return {
    remuneracao: {
      salario_centavos: 0,
      vale_adiantamento_centavos: 0,
      diarias_centavos: 0,
      empreitas_centavos: 0,
      outros_centavos: 0
    },
    beneficios: {
      alimentacao_centavos: 0,
      transporte_centavos: 0,
      outros_centavos: 0
    },
    descontos: {
      faltas_centavos: 0,
      outros_centavos: 0
    },
    encargos: {
      inss_centavos: 0,
      fgts_centavos: 0,
      outros_centavos: 0
    }
  }
}

function overviewCellProperty(key) {
  const [group, field] = key.split('.')
  return { group, property: `${field}_centavos` }
}

function payrollOverviewEmployeeRow({ employee, cargo = null, launches = [], benefits = [] }) {
  const values = emptyPayrollOverviewValues()
  const sources = Object.fromEntries(PAYROLL_OVERVIEW_COLUMNS.map(item => [item.key, []]))
  const catalog = benefitMap(benefits)

  for (const launch of launches) {
    const key = classifyPayrollOverviewLaunch(launch, catalog)
    const target = overviewCellProperty(key)
    values[target.group][target.property] += money(launch?.valor_centavos)
    sources[key].push(launchSource(launch))
  }

  const remuneracao = Object.values(values.remuneracao).reduce((sum, value) => sum + money(value), 0)
  const beneficiosTotal = Object.values(values.beneficios).reduce((sum, value) => sum + money(value), 0)
  const descontosTotal = Object.values(values.descontos).reduce((sum, value) => sum + money(value), 0)
  const encargosTotal = Object.values(values.encargos).reduce((sum, value) => sum + money(value), 0)
  const totalFuncionario = Math.max(0, remuneracao + beneficiosTotal - descontosTotal)

  return {
    funcionario_id: employee?.id ?? null,
    funcionario_nome: employee?.nome || '',
    cargo_id: cargo?.id ?? employee?.cargo_id ?? null,
    cargo_nome: cargo?.nome || 'Sem cargo',
    ...values,
    total_funcionario_centavos: totalFuncionario,
    custo_empresa_centavos: totalFuncionario + encargosTotal,
    sources
  }
}

function payrollOverviewCompanyExpenseRows(accounts = []) {
  return accounts
    .filter(account => account && account.tipo === 'pagar' && !account.deleted_at)
    .filter(account => {
      const category = normalizeLabel(account.categoria_nome || account.categoria?.nome)
      const origin = normalizeLabel(account.origem_tipo)
      return category !== 'folha de pagamento' && !['folha_pagamento','payroll','payroll_generated'].includes(origin)
    })
    .map(account => {
      const description = normalizeLabel(account.descricao)
      const category = normalizeLabel(account.categoria_nome || account.categoria?.nome)
      let group = 'outras'
      if (/contab/.test(description) || /contab/.test(category)) group = 'contabilidade'
      else if (/simples|\bdas\b|darf|impost|tribut/.test(description) || /impost|tribut/.test(category)) group = 'impostos'
      else if (account.recorrencia) group = 'fixas'
      return {
        id: account.id ?? null,
        descricao: account.descricao || '',
        categoria_nome: account.categoria_nome || account.categoria?.nome || null,
        group,
        valor_centavos: money(account.valor_centavos),
        vencimento: account.vencimento || null,
        status: account.status || null,
        recorrencia: account.recorrencia || null,
        sources: [accountSource(account)]
      }
    })
}

function payrollOverviewColumnValue(row, key) {
  const { group, property } = overviewCellProperty(key)
  return money(row?.[group]?.[property])
}

function buildPayrollOverview({
  competencia,
  empresa_id = null,
  obra_id = null,
  employeeEntries = [],
  accounts = [],
  benefits = []
}) {
  const employees = employeeEntries.map(entry => payrollOverviewEmployeeRow({
    employee: entry.employee,
    cargo: entry.cargo,
    launches: entry.launches,
    benefits: entry.benefits || benefits
  }))
  const companyExpenses = payrollOverviewCompanyExpenseRows(accounts)
  const byColumn = Object.fromEntries(PAYROLL_OVERVIEW_COLUMNS.map(column => [
    column.key,
    employees.reduce((sum, row) => sum + payrollOverviewColumnValue(row, column.key), 0)
  ]))
  const totalFuncionarios = employees.reduce((sum, row) => sum + row.total_funcionario_centavos, 0)
  const custoFuncionarios = employees.reduce((sum, row) => sum + row.custo_empresa_centavos, 0)
  const despesasEmpresa = companyExpenses.reduce((sum, row) => sum + row.valor_centavos, 0)

  return {
    contract_version: 1,
    competencia,
    filters: { empresa_id, obra_id },
    columns: PAYROLL_OVERVIEW_COLUMNS,
    employees,
    company_expenses: companyExpenses,
    totals: {
      by_column_centavos: byColumn,
      total_funcionarios_centavos: totalFuncionarios,
      custo_funcionarios_centavos: custoFuncionarios,
      despesas_empresa_centavos: despesasEmpresa,
      custo_competencia_centavos: custoFuncionarios + despesasEmpresa
    }
  }
}

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
  if (amount < total) return 'parcialmente_pago'
  return account?.tipo === 'pagar' ? 'pago' : 'recebido'
}

module.exports = {
  PAYROLL_OVERVIEW_COLUMNS,
  payrollOverviewEmployeeRow,
  payrollOverviewCompanyExpenseRows,
  buildPayrollOverview,
  payrollAmount,
  payrollPendingRows,
  planningCurve,
  planningCash,
  rdoChildRows,
  rdoOccurrenceTask,
  paymentStatus
}
