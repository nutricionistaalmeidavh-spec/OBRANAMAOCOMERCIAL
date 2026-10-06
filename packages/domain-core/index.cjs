function money(value) { return Number(value || 0) }

const PAYROLL_IMPORT_COMPONENTS = Object.freeze([
  { field:'salario_centavos', key:'remuneracao.salario', tipo:'salario', descricao:'Salário base', natureza:'credito', quinzena:1, fixed:true },
  { field:'vale_adiantamento_centavos', key:'remuneracao.vale_adiantamento', tipo:'vale_adiantamento', descricao:'Vale / adiantamento', natureza:'credito', quinzena:2 },
  { field:'diarias_centavos', key:'remuneracao.diarias', tipo:'diaria', descricao:'Diárias', natureza:'credito', quinzena:1 },
  { field:'empreitas_centavos', key:'remuneracao.empreitas', tipo:'empreita', descricao:'Empreitas', natureza:'credito', quinzena:1 },
  { field:'alimentacao_centavos', key:'beneficios.alimentacao', tipo:'beneficio_importado_alimentacao', descricao:'Alimentação', natureza:'credito', quinzena:1, benefit:true },
  { field:'transporte_centavos', key:'beneficios.transporte', tipo:'beneficio_importado_transporte', descricao:'Transporte', natureza:'credito', quinzena:1, benefit:true },
  { field:'outros_beneficios_centavos', key:'beneficios.outros', tipo:'beneficio_importado_outros', descricao:'Outros benefícios', natureza:'credito', quinzena:1, benefit:true },
  { field:'faltas_centavos', key:'descontos.faltas', tipo:'falta', descricao:'Faltas', natureza:'desconto', quinzena:1 },
  { field:'outros_descontos_centavos', key:'descontos.outros', tipo:'outro_desconto', descricao:'Outros descontos', natureza:'desconto', quinzena:1 },
  { field:'inss_centavos', key:'encargos.inss', tipo:'inss', descricao:'INSS', natureza:'credito', quinzena:null, employerCharge:true },
  { field:'fgts_centavos', key:'encargos.fgts', tipo:'fgts', descricao:'FGTS', natureza:'credito', quinzena:null, employerCharge:true },
  { field:'outros_encargos_centavos', key:'encargos.outros', tipo:'encargo_importado_outros', descricao:'Outros encargos', natureza:'credito', quinzena:null, employerCharge:true }
])

function payrollImportComponents(values = {}) {
  return PAYROLL_IMPORT_COMPONENTS
    .map(component => ({ ...component, valor_centavos: Math.max(0, money(values?.[component.field])) }))
    .filter(component => component.valor_centavos > 0)
}

function payrollImportCurrentValues(row = {}) {
  const result = {}
  for (const component of PAYROLL_IMPORT_COMPONENTS) result[component.field] = payrollOverviewColumnValue(row, component.key)
  return result
}

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
  if (tipo.startsWith('beneficio_importado_')) {
    if (tipo.endsWith('_alimentacao')) return 'beneficios.alimentacao'
    if (tipo.endsWith('_transporte')) return 'beneficios.transporte'
    return 'beneficios.outros'
  }
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
    .filter(account => account && account.tipo === 'pagar' && !account.deleted_at && normalizeLabel(account.status) !== 'cancelado')
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
  const payableRows = rows.filter(row => !classifyPayrollOverviewLaunch(row, new Map()).startsWith('encargos.'))
  const credits = payableRows.filter(row => row.natureza === 'credito').reduce((sum, row) => sum + money(row.valor_centavos), 0)
  const discounts = payableRows.filter(row => row.natureza === 'desconto').reduce((sum, row) => sum + money(row.valor_centavos), 0)
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


const PAYROLL_IMPORT_DEFINITIONS = Object.freeze([
  { field:'salario_centavos', key:'remuneracao.salario', tipo:'salario', descricao:'Salário', natureza:'credito', quinzena:1 },
  { field:'vale_adiantamento_centavos', key:'remuneracao.vale_adiantamento', tipo:'vale_adiantamento', descricao:'Vale / adiantamento', natureza:'credito', quinzena:2 },
  { field:'diarias_centavos', key:'remuneracao.diarias', tipo:'diaria', descricao:'Diárias', natureza:'credito', quinzena:1 },
  { field:'empreitas_centavos', key:'remuneracao.empreitas', tipo:'empreita', descricao:'Empreitas', natureza:'credito', quinzena:1 },
  { field:'alimentacao_centavos', key:'beneficios.alimentacao', tipo:'beneficio_importado_alimentacao', descricao:'Alimentação', natureza:'credito', quinzena:1 },
  { field:'transporte_centavos', key:'beneficios.transporte', tipo:'beneficio_importado_transporte', descricao:'Transporte', natureza:'credito', quinzena:1 },
  { field:'outros_beneficios_centavos', key:'beneficios.outros', tipo:'beneficio_importado_outros', descricao:'Outros benefícios', natureza:'credito', quinzena:1 },
  { field:'faltas_centavos', key:'descontos.faltas', tipo:'falta', descricao:'Faltas', natureza:'desconto', quinzena:1 },
  { field:'outros_descontos_centavos', key:'descontos.outros', tipo:'outro_desconto', descricao:'Outros descontos', natureza:'desconto', quinzena:1 },
  { field:'inss_centavos', key:'encargos.inss', tipo:'inss', descricao:'INSS', natureza:'credito', quinzena:null },
  { field:'fgts_centavos', key:'encargos.fgts', tipo:'fgts', descricao:'FGTS', natureza:'credito', quinzena:null },
  { field:'outros_encargos_centavos', key:'encargos.outros', tipo:'encargo_importado', descricao:'Outros encargos', natureza:'credito', quinzena:null }
])

function payrollImportName(value) {
  return normalizeLabel(value).replace(/\s+/g,' ').trim()
}

function payrollImportJson(value, fallback = {}) {
  try { return JSON.parse(value || '') } catch { return fallback }
}

function createPayrollImportEngine(adapter) {
  if (!adapter?.db || typeof adapter.save !== 'function' || typeof adapter.ensureSheet !== 'function') throw new Error('Adaptador de importação da folha inválido.')
  const db = adapter.db
  const save = adapter.save
  const transact = (work) => {
    if (typeof adapter.transaction === 'function') return adapter.transaction(work)
    if (typeof db.transaction === 'function') return db.transaction(work)()
    db.exec('BEGIN IMMEDIATE;')
    try { const result = work(); db.exec('COMMIT;'); return result }
    catch (error) { try { db.exec('ROLLBACK;') } catch {} throw error }
  }
  const get = adapter.get || ((table,id) => db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(Number(id)))

  const catalog = () => new Map(db.prepare("SELECT id,nome,tipo FROM beneficios WHERE ativo=1").all().map(item => [Number(item.id), item]))
  const companyId = payload => {
    const requested = Number(payload?.empresa_id) || null
    if (requested) {
      const company = db.prepare("SELECT * FROM empresas WHERE id=? AND deleted_at IS NULL").get(requested)
      if (!company) throw new Error('Empresa selecionada não foi encontrada.')
      return requested
    }
    const companies = db.prepare("SELECT * FROM empresas WHERE deleted_at IS NULL ORDER BY id").all()
    if (!companies.length) throw new Error('Cadastre uma empresa antes de importar a folha.')
    if (companies.length !== 1) throw new Error('Selecione uma empresa específica antes de importar a planilha.')
    return Number(companies[0].id)
  }
  const employeePool = empresaId => db.prepare("SELECT * FROM funcionarios WHERE deleted_at IS NULL AND status='ativo' AND empresa_id=? ORDER BY nome COLLATE NOCASE,id").all(empresaId)
  const resolveEmployee = (row, empresaId) => {
    const employees = employeePool(empresaId)
    const cpf = String(row?.cpf || '').replace(/\D/g,'')
    if (cpf) {
      const matches = employees.filter(item => String(item.cpf || '').replace(/\D/g,'') === cpf)
      if (matches.length === 1) return { kind:'match', employee:matches[0] }
      if (matches.length > 1) return { kind:'ambiguous', candidates:matches }
    }
    const name = payrollImportName(row?.funcionario)
    if (!name) return { kind:'missing', candidates:[] }
    const matches = employees.filter(item => payrollImportName(item.nome) === name)
    if (matches.length === 1) return { kind:'match', employee:matches[0] }
    if (matches.length > 1) return { kind:'ambiguous', candidates:matches }
    return { kind:'not_found', candidates:[] }
  }
  const sheetFor = (employee, competencia) => db.prepare("SELECT * FROM folhas_pagamento WHERE empresa_id=? AND competencia=?").get(employee.empresa_id, competencia)
  const launchRows = (employee, competencia) => {
    const sheet = sheetFor(employee, competencia)
    if (!sheet) return []
    return db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? ORDER BY id").all(sheet.id, employee.id)
  }
  const rowsForKey = (rows, key) => {
    const benefits = catalog()
    return rows.filter(row => classifyPayrollOverviewLaunch(row, benefits) === key)
  }
  const conflictId = (rowId, field) => `${rowId}:${field}`
  const definitionFor = field => PAYROLL_IMPORT_DEFINITIONS.find(item => item.field === field)
  const configuredValue = (employee, competencia, definition) => {
    if (definition.field === 'salario_centavos') {
      const cargo = employee.cargo_id ? db.prepare('SELECT * FROM cargos WHERE id=?').get(employee.cargo_id) : null
      return money(employee.salario_centavos || cargo?.salario_base_centavos || 0)
    }
    if (!definition.key.startsWith('beneficios.')) return 0
    const byBenefit = new Map()
    if (employee.cargo_id) {
      const rows = db.prepare(`
        SELECT cb.*,b.nome,b.tipo
        FROM cargo_beneficios cb JOIN beneficios b ON b.id=cb.beneficio_id
        WHERE cb.cargo_id=? AND cb.ativo=1 AND b.ativo=1
      `).all(employee.cargo_id)
      for (const row of rows) byBenefit.set(Number(row.beneficio_id), row)
    }
    const overrides = db.prepare(`
      SELECT fb.*,b.nome,b.tipo
      FROM funcionario_beneficios fb JOIN beneficios b ON b.id=fb.beneficio_id
      WHERE fb.funcionario_id=? AND b.ativo=1
        AND (fb.inicio IS NULL OR substr(fb.inicio,1,7)<=?)
        AND (fb.fim IS NULL OR substr(fb.fim,1,7)>=?)
      ORDER BY fb.beneficio_id,fb.inicio DESC
    `).all(employee.id,competencia,competencia)
    const seen = new Set()
    for (const row of overrides) {
      if (seen.has(Number(row.beneficio_id))) continue
      seen.add(Number(row.beneficio_id))
      byBenefit.set(Number(row.beneficio_id), row)
    }
    const benefitCatalog = catalog()
    return [...byBenefit.values()].reduce((sum,row)=>{
      const key = classifyPayrollOverviewLaunch({
        tipo:`beneficio_${row.beneficio_id}`,descricao:row.nome,natureza:row.natureza || 'credito',valor_centavos:row.valor_centavos
      },benefitCatalog)
      return key === definition.key ? sum + money(row.valor_centavos) : sum
    },0)
  }
  const currentValue = (employee, competencia, definition) => {
    const rows = rowsForKey(launchRows(employee, competencia), definition.key)
    const total = rows.reduce((sum,row)=>sum+money(row.valor_centavos),0)
    if (total) return { value:total, rows, paid:rows.some(row=>row.status==='pago') }
    if (!sheetFor(employee, competencia)) {
      const configured = configuredValue(employee,competencia,definition)
      if (configured) return { value:configured, rows:[], paid:false, configured:true }
    }
    return { value:0, rows:[], paid:false }
  }
  const duplicateExpense = (empresaId, competencia, row) => db.prepare(`
    SELECT * FROM contas
    WHERE empresa_id=? AND tipo='pagar' AND competencia=? AND deleted_at IS NULL
      AND lower(trim(descricao))=lower(trim(?)) AND valor_centavos=?
    ORDER BY id LIMIT 1
  `).get(empresaId, competencia, row.descricao, money(row.valor_centavos))

  function preview(payload = {}) {
    const competencia = String(payload.competencia || '')
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error('Competência inválida para importação.')
    const empresaId = companyId(payload)
    const obraId = Number(payload.obra_id) || null
    if (obraId) {
      const work = db.prepare("SELECT * FROM obras WHERE id=? AND deleted_at IS NULL").get(obraId)
      if (!work || Number(work.empresa_id) !== Number(empresaId)) throw new Error('A obra selecionada não pertence à empresa.')
    }

    const resolutions = payload.resolutions || {}
    const flatConflicts = []
    const unresolved = []
    const blockers = []
    const resultRows = []
    let employeeRows = 0, expenseRows = 0, values = 0, alreadyEqual = 0

    const scope = `payroll:${payload.file?.sheet || 'planilha'}:${competencia}`
    if (payload.file?.hash) {
      const duplicate = db.prepare("SELECT id FROM importacoes WHERE hash=? AND aba=? AND status='concluida'").get(payload.file.hash,scope)
      if (duplicate) blockers.push({ key:'duplicate_import', id:'duplicate_import', kind:'duplicate_import', type:'duplicate_import', message:'Este arquivo e esta aba já foram importados para esta competência.', importacao_id:duplicate.id })
    }

    for (const source of Array.isArray(payload.rows) ? payload.rows : []) {
      const row = { ...source, conflicts:[], status:'ready' }
      if (row.kind === 'employee') {
        employeeRows++
        const employeeResolution = resolutions[row.id]
        let resolution = resolveEmployee(row, empresaId)
        const selectedEmployeeId = typeof employeeResolution === 'string' && employeeResolution.startsWith('employee:')
          ? Number(employeeResolution.split(':')[1])
          : Number(employeeResolution?.employee_id) || null
        const employeeAction = typeof employeeResolution === 'string' ? employeeResolution : employeeResolution?.employee_action
        if (selectedEmployeeId) {
          const selected = employeePool(empresaId).find(item => Number(item.id) === Number(selectedEmployeeId))
          if (selected) resolution = { kind:'match', employee:selected, candidates:[selected], resolved:true }
        } else if (employeeAction === 'create' && String(row.funcionario || '').trim()) {
          resolution = { kind:'create', employee:null, candidates:[], resolved:true }
        } else if (employeeAction === 'skip') {
          resolution = { kind:'skip', employee:null, candidates:[], resolved:true }
        }

        row.employee_match = resolution.kind
        row.employee_id = resolution.employee?.id || null
        row.candidates = (resolution.candidates || []).map(item => ({ id:item.id, nome:item.nome, cpf:item.cpf || null }))
        row.match = { kind:resolution.kind, employee:resolution.employee ? { id:resolution.employee.id, nome:resolution.employee.nome, cpf:resolution.employee.cpf || null } : null, candidates:row.candidates }

        if (resolution.kind === 'skip') { row.status='skip'; resultRows.push(row); continue }
        if (resolution.kind === 'missing' || resolution.kind === 'not_found' || resolution.kind === 'ambiguous') {
          const kind = resolution.kind === 'ambiguous' ? 'employee_ambiguous' : 'employee_not_found'
          const issue = {
            key:row.id, id:row.id, kind, type:kind, row_id:row.id, field:'employee',
            label:resolution.kind === 'ambiguous' ? `${row.funcionario}: há mais de um cadastro possível` : `${row.funcionario || 'Funcionário'} não encontrado`,
            message:resolution.kind === 'ambiguous' ? 'Escolha o cadastro correto ou ajuste CPF/nome na planilha.' : 'Escolha criar o funcionário ou ignorar esta linha.',
            options:resolution.kind === 'ambiguous'
              ? row.candidates.map(item=>({value:`employee:${item.id}`,label:`${item.nome}${item.cpf?` · CPF ${item.cpf}`:''}`}))
              : [{value:'create',label:'Criar funcionário'},{value:'skip',label:'Ignorar linha'}]
          }
          row.conflicts.push(issue); flatConflicts.push(issue); unresolved.push(issue); row.status='conflict'; resultRows.push(row); continue
        }

        if (resolution.kind === 'create') {
          const cpf = String(row.cpf || '').replace(/\D/g,'')
          if (cpf && db.prepare("SELECT id FROM funcionarios WHERE empresa_id=? AND deleted_at IS NULL").all(empresaId).some(item=>{
            const current=db.prepare("SELECT cpf FROM funcionarios WHERE id=?").get(item.id)
            return String(current?.cpf||'').replace(/\D/g,'')===cpf
          })) {
            const issue={key:row.id,id:row.id,kind:'cpf_conflict',type:'cpf_conflict',row_id:row.id,field:'employee',message:'O CPF da linha já pertence a outro funcionário.'}
            row.conflicts.push(issue);flatConflicts.push(issue);blockers.push(issue);row.status='blocked'
          }
          for (const definition of PAYROLL_IMPORT_DEFINITIONS) if (money(row.values?.[definition.field])>0) values++
          resultRows.push(row);continue
        }

        const employee = resolution.employee
        const sheet = sheetFor(employee,competencia)
        if (sheet && sheet.status !== 'aberta') {
          const issue={key:row.id,id:row.id,kind:'closed_sheet',type:'closed_sheet',row_id:row.id,message:'A folha desta competência não está aberta.'}
          row.conflicts.push(issue);flatConflicts.push(issue);blockers.push(issue);row.status='blocked'
        }
        const paidCount = Number(db.prepare("SELECT COUNT(*) total FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND status='pago'").get(employee.id,competencia)?.total || 0)
        if (paidCount) {
          const issue={key:row.id,id:row.id,kind:'paid_employee',type:'paid_employee',row_id:row.id,message:'Este funcionário já possui pagamento confirmado na competência.'}
          row.conflicts.push(issue);flatConflicts.push(issue);blockers.push(issue);row.status='blocked'
        }

        for (const definition of PAYROLL_IMPORT_DEFINITIONS) {
          const imported = money(row.values?.[definition.field])
          if (imported <= 0) continue
          values++
          const current = currentValue(employee, competencia, definition)
          row.existing = { ...(row.existing || {}), [definition.field]:current.value }
          if (current.value === imported) { alreadyEqual++; continue }
          if (current.value > 0) {
            const key = conflictId(row.id,definition.field)
            const decision = resolutions[key]
            const issue = {
              key,id:key,kind:current.paid?'paid_value_conflict':'value_conflict',type:current.paid?'paid_value_conflict':'value_conflict',
              row_id:row.id,field:definition.field,label:`${employee.nome} · ${definition.descricao}`,
              current_centavos:current.value,imported_centavos:imported,resolution:decision || null,
              message:`${definition.descricao}: o valor atual difere da planilha.`,
              options:current.paid
                ? [{value:'keep_current',label:'Manter valor atual'},{value:'skip_row',label:'Ignorar funcionário'}]
                : [{value:'use_import',label:'Usar valor da planilha'},{value:'keep_current',label:'Manter valor atual'},{value:'skip_row',label:'Ignorar funcionário'}]
            }
            row.conflicts.push(issue);flatConflicts.push(issue)
            if (current.paid) blockers.push(issue)
            else if (!['use_import','keep_current','skip_row'].includes(decision)) unresolved.push(issue)
          }
        }
        if (row.status!=='blocked' && row.conflicts.length) row.status='conflict'
      } else if (row.kind === 'expense') {
        expenseRows++; values++
        const existing = db.prepare(`
          SELECT * FROM contas
          WHERE empresa_id=? AND tipo='pagar' AND competencia=? AND deleted_at IS NULL
            AND lower(trim(descricao))=lower(trim(?))
          ORDER BY id
        `).all(empresaId,competencia,row.descricao)
        row.existing = existing.map(item=>({id:item.id,descricao:item.descricao,valor_centavos:item.valor_centavos,status:item.status}))
        const same = existing.find(item=>money(item.valor_centavos)===money(row.valor_centavos))
        if (same) {
          row.status='same';row.duplicate_account_id=same.id;alreadyEqual++
        } else if (existing.length) {
          const key=conflictId(row.id,'valor_despesa')
          const decision=resolutions[key]
          const issue={
            key,id:key,kind:'expense_conflict',type:'expense_conflict',row_id:row.id,field:'valor_despesa',
            label:`${row.descricao}: já existe uma conta com outro valor`,current_centavos:money(existing[0].valor_centavos),
            imported_centavos:money(row.valor_centavos),resolution:decision||null,message:'Escolha manter o valor atual ou usar o valor da planilha.',
            options:[{value:'keep_current',label:'Manter valor atual'},{value:'use_import',label:'Usar valor da planilha'},{value:'skip_row',label:'Ignorar linha'}]
          }
          row.conflicts.push(issue);flatConflicts.push(issue);row.status='conflict'
          if (!['use_import','keep_current','skip_row'].includes(decision)) unresolved.push(issue)
          if (['pago','recebido','cancelado'].includes(String(existing[0].status||'')) && decision==='use_import') {
            const locked={...issue,key:key+':locked',id:key+':locked',kind:'locked_expense',type:'locked_expense',message:'A conta existente não pode ser sobrescrita no status atual.'}
            row.conflicts.push(locked);flatConflicts.push(locked);blockers.push(locked);row.status='blocked'
          }
        }
      }
      resultRows.push(row)
    }

    const summary={
      employees:employeeRows,expenses:expenseRows,conflicts:flatConflicts.length,
      unresolved:unresolved.length,blockers:blockers.length,values,already_equal:alreadyEqual
    }
    return {
      contract_version:1,competencia,empresa_id:empresaId,obra_id:obraId,
      empresa:{id:empresaId},file:payload.file||null,mode:payload.mode||'universal',mapping:payload.mapping||{},
      rows:resultRows,conflicts:flatConflicts,unresolved,blockers,summary,
      stats:{employee_rows:employeeRows,expense_rows:expenseRows,values,already_equal:alreadyEqual,conflicts:flatConflicts.length},
      canCommit:blockers.length===0 && unresolved.length===0 && resultRows.length>0
    }
  }

  function importLine(insert, input) {
    const result = insert.run(
      input.importacao_id,input.competencia,input.celula,input.tipo,input.nome_origem,input.valor_centavos,
      JSON.stringify(input.dados_brutos || {}),input.entidade_tipo || null,input.entidade_id || null,input.status || 'pendente'
    )
    return Number(result.lastInsertRowid)
  }

  function categoryFor(name, description = '') {
    const explicit = String(name || '').trim()
    const reference = `${explicit} ${description}`
    const fallback = /simples|\bdas\b|darf|impost|tribut/i.test(reference) ? 'Impostos'
      : /contab/i.test(reference) ? 'Serviços terceiros' : 'Outras despesas'
    const categoryName = explicit || fallback
    let category = db.prepare("SELECT * FROM categorias_financeiras WHERE lower(nome)=lower(?)").get(categoryName)
    if (!category) category = save('categorias_financeiras',{ nome:categoryName,natureza:'despesa',grupo_dre:/impost|tribut|simples|das|darf/i.test(categoryName)?'tributos':'operacional',ativa:1 })
    return category
  }

  function commit(payload = {}) {
    const checked = preview(payload)
    const resolutions = payload.resolutions || {}
    if (!checked.canCommit) throw new Error('Resolva os conflitos da prévia antes de confirmar a importação.')
    const aba = `payroll:${checked.file?.sheet || 'planilha'}:${checked.competencia}`

    return transact(() => {
      if (checked.file?.hash && db.prepare("SELECT id FROM importacoes WHERE hash=? AND aba=? AND status='concluida'").get(checked.file.hash,aba)) {
        throw new Error('Esta planilha já foi importada para esta competência.')
      }
      const imported = save('importacoes',{arquivo:checked.file?.name || checked.file?.path || 'planilha',hash:checked.file?.hash || '',aba,status:'processando',resumo:'{}'})
      const lineInsert = db.prepare('INSERT INTO importacao_linhas(importacao_id,competencia,celula,tipo,nome_origem,valor_centavos,dados_brutos,entidade_tipo,entidade_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)')
      const lineUpdate = db.prepare("UPDATE importacao_linhas SET entidade_tipo=?,entidade_id=?,status=? WHERE id=?")
      let created=0,updated=0,ignored=0,employeesCreated=0,expensesCreated=0,importedValues=0,importedExpenses=0

      for (const row of checked.rows) {
        if (row.status==='skip') { ignored++; continue }

        if (row.kind==='employee') {
          const employeeResolution=resolutions[row.id]
          const rowSkip=row.conflicts?.some(item=>resolutions[item.key]==='skip_row')
          if (rowSkip || employeeResolution==='skip' || employeeResolution?.employee_action==='skip') { ignored++; continue }

          let employee=row.employee_id ? get('funcionarios',row.employee_id) : null
          const selectedEmployeeId=typeof employeeResolution==='string'&&employeeResolution.startsWith('employee:')?Number(employeeResolution.split(':')[1]):Number(employeeResolution?.employee_id)||null
          const employeeAction=typeof employeeResolution==='string'?employeeResolution:employeeResolution?.employee_action
          if (!employee && selectedEmployeeId) employee=get('funcionarios',selectedEmployeeId)
          if (!employee && employeeAction==='create') {
            employee=save('funcionarios',{
              empresa_id:checked.empresa_id,obra_atual_id:checked.obra_id || null,nome:String(row.funcionario||'').trim(),
              cpf:String(row.cpf||'').replace(/\D/g,'') || null,status:'ativo',salario_centavos:0
            })
            employeesCreated++
            importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:'funcionario',nome_origem:row.funcionario,valor_centavos:0,dados_brutos:{created:true,row:row.raw||{}},entidade_tipo:'funcionarios',entidade_id:employee.id,status:'importado'})
          }
          if (!employee) { ignored++; continue }

          const data=adapter.ensureSheet(employee.id,checked.competencia)
          for (const definition of PAYROLL_IMPORT_DEFINITIONS) {
            const amount=money(row.values?.[definition.field])
            if (amount<=0) continue
            const conflict=row.conflicts?.find(item=>item.field===definition.field && ['value_conflict','paid_value_conflict'].includes(item.kind))
            const decision=conflict ? resolutions[conflict.key] : null
            if (decision==='keep_current') {
              importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:definition.field,nome_origem:employee.nome,valor_centavos:amount,dados_brutos:{operation:'none',decision:'keep_current',row:row.raw||{}},status:'ignorado'})
              ignored++;continue
            }

            const current=currentValue(employee,checked.competencia,definition)
            if (current.value===amount) {
              importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:definition.field,nome_origem:employee.nome,valor_centavos:amount,dados_brutos:{operation:'none',decision:'already_equal',row:row.raw||{}},status:'sem_alteracao'})
              ignored++;continue
            }
            if (current.paid) throw new Error(`${employee.nome}: ${definition.descricao} já possui lançamento pago e não pode ser substituído.`)
            const replaced=current.rows.map(item=>({
              empresa_id:item.empresa_id,folha_id:item.folha_id,funcionario_id:item.funcionario_id,tipo:item.tipo,descricao:item.descricao,natureza:item.natureza,
              quinzena:item.quinzena,valor_centavos:item.valor_centavos,quantidade:item.quantidade,data:item.data,origem:item.origem,editavel:item.editavel,status:item.status,
              importacao_linha_id:item.importacao_linha_id || null
            }))
            const lineId=importLine(lineInsert,{
              importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:definition.field,nome_origem:employee.nome,valor_centavos:amount,
              dados_brutos:{operation:replaced.length?'update':'create',field:definition.field,replaced,row:row.raw||{},valor_centavos:amount},status:'processando'
            })
            for (const old of current.rows) if (old.status!=='pago') db.prepare("DELETE FROM folha_lancamentos WHERE id=?").run(old.id)
            const launch=save('folha_lancamentos',{
              empresa_id:employee.empresa_id,folha_id:data.sheet.id,funcionario_id:employee.id,tipo:definition.tipo,descricao:definition.descricao,
              natureza:definition.natureza,quinzena:definition.quinzena,valor_centavos:amount,origem:'importacao',editavel:1,status:'pendente',importacao_linha_id:lineId
            })
            lineUpdate.run('folha_lancamentos',launch.id,'importado',lineId)
            if (replaced.length) updated++; else created++
            importedValues++
          }
        } else if (row.kind==='expense') {
          const existing=db.prepare(`
            SELECT * FROM contas WHERE empresa_id=? AND tipo='pagar' AND competencia=? AND deleted_at IS NULL
              AND lower(trim(descricao))=lower(trim(?)) ORDER BY id LIMIT 1
          `).get(checked.empresa_id,checked.competencia,row.descricao)
          if (existing && money(existing.valor_centavos)===money(row.valor_centavos)) {
            importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:'despesa',nome_origem:row.descricao,valor_centavos:row.valor_centavos,dados_brutos:{operation:'none',before:existing},entidade_tipo:'contas',entidade_id:existing.id,status:'sem_alteracao'})
            ignored++;continue
          }
          const conflict=row.conflicts?.find(item=>item.field==='valor_despesa'&&item.kind==='expense_conflict')
          const decision=conflict ? resolutions[conflict.key] : null
          if (existing && (decision==='keep_current'||decision==='skip_row')) {
            importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:'despesa',nome_origem:row.descricao,valor_centavos:row.valor_centavos,dados_brutos:{operation:'none',decision,before:existing},entidade_tipo:'contas',entidade_id:existing.id,status:'ignorado'})
            ignored++;continue
          }

          const category=categoryFor(row.categoria,row.descricao)
          const operation=existing?'update':'create'
          const lineId=importLine(lineInsert,{
            importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:'despesa',nome_origem:row.descricao,valor_centavos:row.valor_centavos,
            dados_brutos:{operation,before:existing||null,descricao:row.descricao,valor_centavos:money(row.valor_centavos),vencimento:row.vencimento || (existing?.vencimento||`${checked.competencia}-20`),categoria:category.nome,categoria_id:category.id,obra_id:checked.obra_id || existing?.obra_id || null,row:row.raw||{}},status:'processando'
          })
          let account
          if (existing) {
            account=save('contas',{...existing,id:existing.id,categoria_id:category.id,obra_id:checked.obra_id || existing.obra_id || null,
              vencimento:row.vencimento || existing.vencimento,valor_bruto_centavos:money(row.valor_centavos),valor_centavos:money(row.valor_centavos),
              origem_tipo:'payroll_import_line',origem_id:lineId})
            updated++;importedExpenses++
          } else {
            account=save('contas',{tipo:'pagar',empresa_id:checked.empresa_id,obra_id:checked.obra_id || null,categoria_id:category.id,descricao:row.descricao,
              competencia:checked.competencia,vencimento:row.vencimento || `${checked.competencia}-20`,valor_bruto_centavos:money(row.valor_centavos),
              valor_centavos:money(row.valor_centavos),status:'pendente',origem_tipo:'payroll_import_line',origem_id:lineId})
            created++;expensesCreated++;importedExpenses++
          }
          lineUpdate.run('contas',account.id,'importado',lineId)
        }
      }

      const summary={
        contract_version:1,competencia:checked.competencia,empresa_id:checked.empresa_id,obra_id:checked.obra_id,mode:checked.mode,
        file:checked.file?.name || null,sheet:checked.file?.sheet || null,created,updated,ignored,employees_created:employeesCreated,
        expenses_created:expensesCreated,imported_values:importedValues,imported_expenses:importedExpenses,created_employees:employeesCreated,skipped:ignored,can_undo:true
      }
      db.prepare("UPDATE importacoes SET status='concluida',resumo=?,concluida_em=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(summary),imported.id)
      return {importacao_id:imported.id,...summary}
    })
  }

  function history(limit = 12) {
    return db.prepare("SELECT * FROM importacoes WHERE aba LIKE 'payroll:%' ORDER BY id DESC LIMIT ?").all(Math.max(1,Math.min(50,Number(limit)||12))).map(item=>({
      ...item,
      summary:payrollImportJson(item.resumo,{}),
      resumo_obj:payrollImportJson(item.resumo,{}),
      can_undo:item.status==='concluida'
    }))
  }

  function undo(importId) {
    const imported = db.prepare("SELECT * FROM importacoes WHERE id=? AND aba LIKE 'payroll:%'").get(Number(importId))
    if (!imported) throw new Error('Importação não encontrada.')
    if (imported.status !== 'concluida') throw new Error('Somente uma importação concluída pode ser desfeita.')
    const lines = db.prepare("SELECT * FROM importacao_linhas WHERE importacao_id=? ORDER BY id DESC").all(imported.id)
    const unsafe = []
    for (const line of lines) {
      if (line.entidade_tipo === 'folha_lancamentos' && line.entidade_id) {
        const launch = db.prepare("SELECT * FROM folha_lancamentos WHERE id=?").get(line.entidade_id)
        if (launch && (launch.status === 'pago' || launch.origem !== 'importacao' || Number(launch.importacao_linha_id)!==Number(line.id))) unsafe.push(`Lançamento #${line.entidade_id} foi alterado ou pago.`)
      }
      if (line.entidade_tipo === 'contas' && line.entidade_id) {
        const account = db.prepare("SELECT * FROM contas WHERE id=?").get(line.entidade_id)
        const raw = payrollImportJson(line.dados_brutos,{})
        const payments = account ? Number(db.prepare("SELECT COUNT(*) total FROM pagamentos_conta WHERE conta_id=?").get(account.id)?.total||0) : 0
        const expectedStatus = raw.operation === 'update' ? raw.before?.status : 'pendente'
        const changed = account && (
          money(account.valor_centavos)!==money(raw.valor_centavos) ||
          String(account.descricao)!==String(raw.descricao) ||
          String(account.vencimento||'')!==String(raw.vencimento||'') ||
          Number(account.categoria_id||0)!==Number(raw.categoria_id||0) ||
          Number(account.obra_id||0)!==Number(raw.obra_id||0) ||
          (expectedStatus && String(account.status)!==String(expectedStatus))
        )
        if (account && (payments>0 || account.origem_tipo!=='payroll_import_line' || Number(account.origem_id)!==Number(line.id) || changed)) unsafe.push(`Conta #${line.entidade_id} foi alterada ou recebeu pagamento.`)
      }
    }
    if (unsafe.length) throw new Error(`Não é seguro desfazer esta importação: ${unsafe.slice(0,3).join(' ')}`)

    return transact(() => {
      const touchedEmployees = new Set()
      let removedValues=0, removedExpenses=0, preservedEmployees=0
      for (const line of lines) {
        const raw = payrollImportJson(line.dados_brutos,{})
        if (line.entidade_tipo === 'folha_lancamentos' && line.entidade_id) {
          const launch = db.prepare("SELECT * FROM folha_lancamentos WHERE id=?").get(line.entidade_id)
          if (launch) {
            touchedEmployees.add(launch.funcionario_id)
            db.prepare("DELETE FROM folha_lancamentos WHERE id=?").run(launch.id)
            removedValues++
          }
          for (const old of Array.isArray(raw.replaced)?raw.replaced:[]) {
            const restored={...old}
            delete restored.id
            save('folha_lancamentos',restored)
          }
        } else if (line.entidade_tipo === 'contas' && line.entidade_id) {
          if (raw.operation === 'update' && raw.before) {
            save('contas',{...raw.before,id:line.entidade_id})
          } else {
            db.prepare("UPDATE contas SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(line.entidade_id)
          }
          removedExpenses++
        }
        db.prepare("UPDATE importacao_linhas SET status='desfeito' WHERE id=?").run(line.id)
      }
      for (const line of lines.filter(item=>item.entidade_tipo==='funcionarios'&&item.entidade_id)) {
        const employee = db.prepare("SELECT * FROM funcionarios WHERE id=? AND deleted_at IS NULL").get(line.entidade_id)
        if (!employee) continue
        const payrollRefs=Number(db.prepare("SELECT COUNT(*) total FROM folha_lancamentos WHERE funcionario_id=?").get(employee.id)?.total||0)
        const paymentRefs=Number(db.prepare("SELECT COUNT(*) total FROM pagamentos_funcionario WHERE funcionario_id=?").get(employee.id)?.total||0)
        const pointRefs=Number(db.prepare("SELECT COUNT(*) total FROM pontos_mensais WHERE funcionario_id=?").get(employee.id)?.total||0)
        const docRefs=Number(db.prepare("SELECT COUNT(*) total FROM documentos WHERE funcionario_id=? AND deleted_at IS NULL").get(employee.id)?.total||0)
        if (payrollRefs+paymentRefs+pointRefs+docRefs===0) db.prepare("UPDATE funcionarios SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(employee.id)
        else preservedEmployees++
      }
      for (const employeeId of touchedEmployees) {
        const employee = db.prepare("SELECT * FROM funcionarios WHERE id=? AND deleted_at IS NULL").get(employeeId)
        if (employee) adapter.ensureSheet(employee.id,payrollImportJson(imported.resumo,{}).competencia || String(imported.aba).split(':').pop())
      }
      const previous=payrollImportJson(imported.resumo,{})
      const summary={...previous,can_undo:false,undo:{removed_values:removedValues,removed_expenses:removedExpenses,preserved_employees:preservedEmployees}}
      db.prepare("UPDATE importacoes SET status='desfeita',resumo=? WHERE id=?").run(JSON.stringify(summary),imported.id)
      return {importacao_id:imported.id,status:'desfeita',...summary.undo}
    })
  }

  return { preview, commit, history, undo }
}

module.exports = {
  PAYROLL_OVERVIEW_COLUMNS,
  PAYROLL_IMPORT_DEFINITIONS,
  createPayrollImportEngine,
  classifyPayrollOverviewLaunch,
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
