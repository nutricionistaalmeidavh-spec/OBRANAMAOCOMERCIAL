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
  { field:'inss_centavos', key:'encargos.inss', tipo:'inss', descricao:'INSS', natureza:'credito', quinzena:1 },
  { field:'fgts_centavos', key:'encargos.fgts', tipo:'fgts', descricao:'FGTS', natureza:'credito', quinzena:1 },
  { field:'outros_encargos_centavos', key:'encargos.outros', tipo:'encargo_importado', descricao:'Outros encargos', natureza:'credito', quinzena:1 }
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
    const company = db.prepare("SELECT * FROM empresas WHERE deleted_at IS NULL ORDER BY id LIMIT 1").get()
    if (!company) throw new Error('Cadastre uma empresa antes de importar a folha.')
    return Number(company.id)
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
  const currentValue = (employee, competencia, definition) => {
    const rows = rowsForKey(launchRows(employee, competencia), definition.key)
    const total = rows.reduce((sum,row)=>sum+money(row.valor_centavos),0)
    if (total) return { value:total, rows, paid:rows.some(row=>row.status==='pago') }
    if (definition.field === 'salario_centavos' && !sheetFor(employee, competencia) && money(employee.salario_centavos)) {
      return { value:money(employee.salario_centavos), rows:[], paid:false, configured:true }
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
    const conflicts = []
    const resultRows = []
    let employeeRows = 0, expenseRows = 0, values = 0, alreadyEqual = 0

    for (const source of Array.isArray(payload.rows) ? payload.rows : []) {
      const row = { ...source }
      if (row.kind === 'employee') {
        employeeRows++
        const resolution = resolveEmployee(row, empresaId)
        row.employee_match = resolution.kind
        row.employee_id = resolution.employee?.id || null
        row.candidates = (resolution.candidates || []).map(item => ({ id:item.id, nome:item.nome, cpf:item.cpf || null }))
        if (resolution.kind === 'missing') {
          conflicts.push({ id:conflictId(row.id,'employee'), row_id:row.id, field:'employee', type:'employee_missing_name', label:`Linha ${row.row_number}: funcionário não informado`, options:[{value:'skip',label:'Ignorar linha'}] })
        } else if (resolution.kind === 'not_found') {
          conflicts.push({ id:conflictId(row.id,'employee'), row_id:row.id, field:'employee', type:'employee_not_found', label:`${row.funcionario || 'Funcionário'} não encontrado`, options:[{value:'create',label:'Criar funcionário'},{value:'skip',label:'Ignorar linha'}] })
        } else if (resolution.kind === 'ambiguous') {
          conflicts.push({ id:conflictId(row.id,'employee'), row_id:row.id, field:'employee', type:'employee_ambiguous', label:`${row.funcionario}: há mais de um cadastro possível`, options:[...(resolution.candidates||[]).map(item=>({value:`employee:${item.id}`,label:`${item.nome}${item.cpf?` · CPF ${item.cpf}`:''}`})),{value:'skip',label:'Ignorar linha'}] })
        }

        const employee = resolution.employee || null
        for (const definition of PAYROLL_IMPORT_DEFINITIONS) {
          const imported = money(row.values?.[definition.field])
          if (imported <= 0) continue
          values++
          if (!employee) continue
          const current = currentValue(employee, competencia, definition)
          row.existing = { ...(row.existing || {}), [definition.field]:current.value }
          if (current.value === imported) { alreadyEqual++; continue }
          if (current.value > 0) {
            const options = current.paid
              ? [{value:'keep_current',label:'Manter valor atual'},{value:'skip_row',label:'Ignorar funcionário'}]
              : [{value:'use_import',label:'Usar valor da planilha'},{value:'keep_current',label:'Manter valor atual'},{value:'skip_row',label:'Ignorar funcionário'}]
            conflicts.push({
              id:conflictId(row.id,definition.field), row_id:row.id, field:definition.field, type:current.paid?'paid_value_conflict':'value_conflict',
              label:`${employee.nome} · ${definition.descricao}`, current_centavos:current.value, imported_centavos:imported, options
            })
          }
        }
      } else if (row.kind === 'expense') {
        expenseRows++
        values++
        const duplicate = duplicateExpense(empresaId,competencia,row)
        row.duplicate_account_id = duplicate?.id || null
        if (duplicate) conflicts.push({
          id:conflictId(row.id,'expense'), row_id:row.id, field:'expense', type:'duplicate_expense',
          label:`${row.descricao}: já existe uma conta igual`, current_centavos:money(duplicate.valor_centavos), imported_centavos:money(row.valor_centavos),
          options:[{value:'keep_current',label:'Manter conta existente'},{value:'import_anyway',label:'Importar mesmo assim'},{value:'skip_row',label:'Ignorar linha'}]
        })
      }
      resultRows.push(row)
    }

    return {
      contract_version:1, competencia, empresa_id:empresaId, obra_id:Number(payload.obra_id)||null,
      file:payload.file || null, mode:payload.mode || 'universal', mapping:payload.mapping || {},
      rows:resultRows, conflicts,
      stats:{employee_rows:employeeRows,expense_rows:expenseRows,values,already_equal:alreadyEqual,conflicts:conflicts.length}
    }
  }

  function importLine(insert, input) {
    const result = insert.run(
      input.importacao_id,input.competencia,input.celula,input.tipo,input.nome_origem,input.valor_centavos,
      JSON.stringify(input.dados_brutos || {}),input.entidade_tipo || null,input.entidade_id || null,input.status || 'pendente'
    )
    return Number(result.lastInsertRowid)
  }

  function categoryFor(name) {
    const explicit = String(name || '').trim()
    const fallback = /simples|\bdas\b|darf|impost|tribut/i.test(explicit) ? 'Impostos'
      : /contab/i.test(explicit) ? 'Serviços terceiros' : 'Outras despesas'
    const categoryName = explicit || fallback
    let category = db.prepare("SELECT * FROM categorias_financeiras WHERE lower(nome)=lower(?)").get(categoryName)
    if (!category) category = save('categorias_financeiras',{ nome:categoryName,natureza:'despesa',grupo_dre:/impost|tribut|simples|das|darf/i.test(categoryName)?'tributos':'operacional',ativa:1 })
    return category
  }

  function commit(payload = {}) {
    const checked = preview(payload)
    const resolutions = payload.resolutions || {}
    const unresolved = checked.conflicts.filter(item => !resolutions[item.id])
    if (unresolved.length) throw new Error(`Resolva ${unresolved.length} conflito(s) antes de confirmar a importação.`)
    const aba = `payroll:${checked.file?.sheet || 'planilha'}:${checked.competencia}`
    return transact(() => {
      if (checked.file?.hash && db.prepare("SELECT id FROM importacoes WHERE hash=? AND aba=? AND status='concluida'").get(checked.file.hash,aba)) {
        throw new Error('Esta planilha já foi importada para esta competência.')
      }
      const imported = save('importacoes',{ arquivo:checked.file?.path || checked.file?.name || 'planilha',hash:checked.file?.hash || '',aba,status:'processando',resumo:'{}' })
      const lineInsert = db.prepare('INSERT INTO importacao_linhas(importacao_id,competencia,celula,tipo,nome_origem,valor_centavos,dados_brutos,entidade_tipo,entidade_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)')
      const lineUpdate = db.prepare("UPDATE importacao_linhas SET entidade_tipo=?,entidade_id=?,status=? WHERE id=?")
      const touchedEmployees = new Set()
      let importedValues=0, importedExpenses=0, createdEmployees=0, skipped=0

      for (const row of checked.rows) {
        const employeeConflict = checked.conflicts.find(item => item.row_id===row.id && item.field==='employee')
        const employeeDecision = employeeConflict ? resolutions[employeeConflict.id] : null
        if (employeeDecision === 'skip') { skipped++; continue }

        if (row.kind === 'employee') {
          let employee = row.employee_id ? get('funcionarios',row.employee_id) : null
          if (employeeConflict?.type === 'employee_ambiguous' && String(employeeDecision||'').startsWith('employee:')) employee = get('funcionarios',Number(String(employeeDecision).split(':')[1]))
          if (!employee && employeeDecision === 'create') {
            employee = save('funcionarios',{
              empresa_id:checked.empresa_id,obra_atual_id:checked.obra_id || null,nome:String(row.funcionario||'').trim(),
              cpf:String(row.cpf||'').replace(/\D/g,'') || null,status:'ativo',salario_centavos:0
            })
            createdEmployees++
            importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:'funcionario',nome_origem:row.funcionario,valor_centavos:0,dados_brutos:{created:true,row:row.raw||{}},entidade_tipo:'funcionarios',entidade_id:employee.id,status:'importado'})
          }
          if (!employee) { skipped++; continue }

          const data = adapter.ensureSheet(employee.id,checked.competencia)
          touchedEmployees.add(employee.id)
          for (const definition of PAYROLL_IMPORT_DEFINITIONS) {
            const amount = money(row.values?.[definition.field])
            if (amount <= 0) continue
            const fieldConflict = checked.conflicts.find(item => item.row_id===row.id && item.field===definition.field)
            const decision = fieldConflict ? resolutions[fieldConflict.id] : null
            if (decision === 'skip_row') { skipped++; break }
            if (decision === 'keep_current') {
              importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:definition.field,nome_origem:employee.nome,valor_centavos:amount,dados_brutos:{decision:'keep_current',row:row.raw||{}},status:'ignorado'})
              continue
            }

            const current = currentValue(employee,checked.competencia,definition)
            if (current.value === amount) {
              importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:definition.field,nome_origem:employee.nome,valor_centavos:amount,dados_brutos:{decision:'already_equal',row:row.raw||{}},status:'mantido'})
              continue
            }
            if (current.paid) throw new Error(`${employee.nome}: ${definition.descricao} já possui lançamento pago e não pode ser substituído.`)
            const replaced = current.rows.map(item=>({
              empresa_id:item.empresa_id,folha_id:item.folha_id,funcionario_id:item.funcionario_id,tipo:item.tipo,descricao:item.descricao,natureza:item.natureza,
              quinzena:item.quinzena,valor_centavos:item.valor_centavos,quantidade:item.quantidade,data:item.data,origem:item.origem,editavel:item.editavel,status:item.status
            }))
            const lineId = importLine(lineInsert,{
              importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:definition.field,nome_origem:employee.nome,valor_centavos:amount,
              dados_brutos:{field:definition.field,replaced,row:row.raw||{}},status:'processando'
            })
            for (const old of current.rows) if (old.status !== 'pago') db.prepare("DELETE FROM folha_lancamentos WHERE id=?").run(old.id)
            const launch = save('folha_lancamentos',{
              empresa_id:employee.empresa_id,folha_id:data.sheet.id,funcionario_id:employee.id,tipo:definition.tipo,descricao:definition.descricao,
              natureza:definition.natureza,quinzena:definition.quinzena,valor_centavos:amount,origem:'importacao',editavel:1,status:'pendente',importacao_linha_id:lineId
            })
            lineUpdate.run('folha_lancamentos',launch.id,'importado',lineId)
            importedValues++
          }
        } else if (row.kind === 'expense') {
          const conflict = checked.conflicts.find(item => item.row_id===row.id && item.field==='expense')
          const decision = conflict ? resolutions[conflict.id] : null
          if (decision === 'skip_row' || decision === 'keep_current') {
            importLine(lineInsert,{importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:'despesa',nome_origem:row.descricao,valor_centavos:row.valor_centavos,dados_brutos:{decision:decision||'keep_current',row:row.raw||{}},status:'ignorado'})
            skipped++; continue
          }
          const category = categoryFor(row.categoria || row.descricao)
          const lineId = importLine(lineInsert,{
            importacao_id:imported.id,competencia:checked.competencia,celula:row.cell,tipo:'despesa',nome_origem:row.descricao,valor_centavos:row.valor_centavos,
            dados_brutos:{descricao:row.descricao,valor_centavos:row.valor_centavos,vencimento:row.vencimento||null,categoria:category.nome,row:row.raw||{}},status:'processando'
          })
          const account = save('contas',{
            tipo:'pagar',empresa_id:checked.empresa_id,obra_id:checked.obra_id || null,categoria_id:category.id,descricao:row.descricao,
            competencia:checked.competencia,vencimento:row.vencimento || `${checked.competencia}-20`,
            valor_bruto_centavos:money(row.valor_centavos),valor_centavos:money(row.valor_centavos),status:'pendente',
            origem_tipo:'payroll_import_line',origem_id:lineId
          })
          lineUpdate.run('contas',account.id,'importado',lineId)
          importedExpenses++
        }
      }

      const summary = {
        contract_version:1,competencia:checked.competencia,empresa_id:checked.empresa_id,obra_id:checked.obra_id,
        mode:checked.mode,file:checked.file?.name || null,imported_values:importedValues,imported_expenses:importedExpenses,
        created_employees:createdEmployees,skipped,conflict_decisions:Object.fromEntries(checked.conflicts.map(item=>[item.id,resolutions[item.id]])),can_undo:true
      }
      db.prepare("UPDATE importacoes SET status='concluida',resumo=?,concluida_em=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(summary),imported.id)
      return { importacao_id:imported.id,...summary }
    })
  }

  function history(limit = 12) {
    return db.prepare("SELECT * FROM importacoes WHERE aba LIKE 'payroll:%' ORDER BY id DESC LIMIT ?").all(Math.max(1,Math.min(50,Number(limit)||12))).map(item=>({
      ...item, summary:payrollImportJson(item.resumo,{}), can_undo:item.status==='concluida'
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
        if (account && (payments>0 || account.origem_tipo!=='payroll_import_line' || Number(account.origem_id)!==Number(line.id) || money(account.valor_centavos)!==money(raw.valor_centavos) || String(account.descricao)!==String(raw.descricao))) unsafe.push(`Conta #${line.entidade_id} foi alterada ou recebeu pagamento.`)
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
            save('folha_lancamentos',{...old,id:undefined,importacao_linha_id:null})
          }
        } else if (line.entidade_tipo === 'contas' && line.entidade_id) {
          db.prepare("UPDATE contas SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(line.entidade_id)
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
