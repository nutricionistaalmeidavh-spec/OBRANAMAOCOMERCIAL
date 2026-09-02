const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')
const { dialog } = require('electron')
const { assertSpreadsheetInput } = require('./spreadsheet-guard.cjs')
const { readWorkbook, sheetRows, encodeCell } = require('./spreadsheet-reader.cjs')

const MONTHS = { JANEIRO:1, FEVEREIRO:2, MARÇO:3, MARCO:3, ABRIL:4, MAIO:5, JUNHO:6, JULHO:7, AGOSTO:8, SETEMBRO:9, OUTUBRO:10, NOVEMBRO:11, DEZEMBRO:12 }
const EXPENSE_SKIP = /^(total|2º quinzena|extras$|receita$|caixa$|despesas$)/i
const REVENUE_SKIP = /^(total|receita$|caixa$|despesas$)/i

function cents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\b(parou|rescisão|inicio|início).*$/i, '').replace(/\s+-\s*$/,'').trim()
}
function parseEmployeeIdentity(value) {
  const raw = normalizeName(value)
  let roleHint = null
  if (/encarregado|erivaldo|galego/i.test(raw)) roleHint = 'Encanador encarregado'
  else if (/ajudante/i.test(raw)) roleHint = 'Ajudante de Encanador'
  else if (/encanador/i.test(raw)) roleHint = 'Encanador'
  else if (/faxineir|limpeza/i.test(raw)) roleHint = 'Auxiliar de limpeza'
  const name = normalizeName(raw.replace(/\s*[-/.]?\s*(encanador\s+encarregado|ajudante(?:\s+de\s+encanador)?|encanador|faxineira)\.?\s*$/i,''))
  return { name: name || raw, roleHint }
}
function latestComponent(months, employeeName, matcher) {
  let found = null
  for (const month of months) {
    const employee = month.employees.find((item) => item.name === employeeName)
    const component = employee?.components.find((item) => matcher.test(item.label))
    if (component && component.value > 0) found = { ...component, competencia: month.competencia }
  }
  return found
}
function mode(values) {
  const counts = new Map()
  for (const value of values.filter(Boolean)) counts.set(value,(counts.get(value)||0)+1)
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || 0
}

async function parseSheet2026(filePath) {
  assertSpreadsheetInput(filePath)
  const workbook = await readWorkbook(filePath)
  const sheet = workbook.getWorksheet('2026')
  if (!sheet) throw new Error('A planilha não possui a aba 2026.')
  const rows = sheetRows(sheet)
  const headers = rows[0] || []
  const starts = []
  headers.forEach((value, col) => {
    const match = String(value || '').toUpperCase().match(/^([A-ZÇÃÕÉÊÍÓÚ]+)\/2026$/)
    if (match && MONTHS[match[1]]) starts.push({ col, month: MONTHS[match[1]], label: value })
  })
  if (!starts.length) throw new Error('Nenhum bloco mensal de 2026 foi encontrado.')
  const months = starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].col - 2 : sheet.columnCount - 1
    const labels = headers.slice(start.col, end + 1).map((v) => String(v || '').trim())
    const employeeRows = []
    for (let r = 3; r <= 20; r++) {
      const identity = parseEmployeeIdentity(rows[r]?.[start.col])
      const name = identity.name
      if (!name || /quinzena|total/i.test(name)) continue
      const components = labels.slice(1).map((label, offset) => ({ label, value: rows[r]?.[start.col + offset + 1], col: start.col + offset + 1 })).filter((x) => x.label && typeof x.value === 'number' && x.value !== 0)
      if (components.length) employeeRows.push({ row: r + 1, name, sourceName: normalizeName(rows[r]?.[start.col]), roleHint: identity.roleHint, components })
    }
    const expenses = []
    for (let r = 41; r <= 73; r++) {
      const name = normalizeName(rows[r]?.[start.col])
      const value = rows[r]?.[start.col + 1]
      if (!name || EXPENSE_SKIP.test(name) || typeof value !== 'number' || value === 0) continue
      expenses.push({ row: r + 1, name, value })
    }
    const revenues = []
    for (let r = 74; r <= 81; r++) {
      const name = normalizeName(rows[r]?.[start.col])
      const value = rows[r]?.[start.col + 1]
      if (!name || REVENUE_SKIP.test(name) || typeof value !== 'number' || value === 0) continue
      revenues.push({ row: r + 1, name, value })
    }
    const expectedRevenue = cents(rows[81]?.[start.col + 1])
    const expectedExpense = cents(rows[83]?.[start.col + 1])
    return { month: start.month, competencia: `2026-${String(start.month).padStart(2,'0')}`, label: start.label, startCol: start.col, labels, employees: employeeRows, expenses, revenues, expectedRevenue, expectedExpense }
  })
  const collisions = new Set()
  for (const month of months) {
    const counts = new Map()
    for (const employee of month.employees) counts.set(employee.name,(counts.get(employee.name)||0)+1)
    for (const [name,count] of counts) if (count > 1) collisions.add(name)
  }
  for (const month of months) for (const employee of month.employees) {
    if (collisions.has(employee.name) && employee.roleHint) employee.name += ' (' + employee.roleHint.replace(' de Encanador','') + ')'
  }
  return { sheet: '2026', months, employeeNames: [...new Set(months.flatMap((m) => m.employees.map((e) => e.name)))].sort(), range: sheet.dimensions }
}

class ImportService {
  constructor({ db }) { this.db = db; this.pending = new Map() }
  async chooseAndPreview() {
    const picked = await dialog.showOpenDialog({ title: 'Selecionar planilha de despesas', properties: ['openFile'], filters: [{ name: 'Planilhas Excel', extensions: ['xlsx','xlsm'] }] })
    if (picked.canceled) return null
    return this.preview(picked.filePaths[0])
  }
  async preview(filePath) {
    const parsed = await parseSheet2026(filePath)
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    const token = crypto.randomUUID()
    this.pending.set(token, { filePath, hash, parsed })
    return {
      token, file: path.basename(filePath), hash, range: parsed.range,
      months: parsed.months.map((m) => ({ competencia: m.competencia, funcionarios: m.employees.length, despesas: m.expenses.length, receitas: m.revenues.length, esperado_receitas_centavos: m.expectedRevenue, esperado_despesas_centavos: m.expectedExpense })),
      employees: parsed.employeeNames
    }
  }
  commit(token) {
    const pending = this.pending.get(token)
    if (!pending) throw new Error('A prévia expirou. Selecione a planilha novamente.')
    const { filePath, hash, parsed } = pending
    return this.db.db.transaction(() => {
      const duplicate = this.db.db.prepare("SELECT id FROM importacoes WHERE hash=? AND aba='2026' AND status='concluida'").get(hash)
      if (duplicate) throw new Error('Esta planilha já foi importada.')
      let company = this.db.db.prepare('SELECT * FROM empresas WHERE deleted_at IS NULL ORDER BY id LIMIT 1').get()
      if (!company) company = this.db.save('empresas', { razao_social: 'MH HIDRAULICA RP LTDA', nome_fantasia: 'MH Hidráulica RP', cnpj: '50.733.669/0001-60', status: 'ativa' })
      const importRow = this.db.save('importacoes', { arquivo: filePath, hash, aba: '2026', status: 'processando', resumo: '{}' })
      const categories = Object.fromEntries(this.db.list('categorias_financeiras').map((c) => [c.nome, c.id]))
      const employeeMap = new Map()
      const benefitDefs = [
        { nome: 'Café', tipo: 'alimentacao', match: /café|cafe/i },
        { nome: 'Vale-alimentação', tipo: 'alimentacao', match: /v\.?\s*aliment|vale[\s-]*aliment/i },
        { nome: 'Vale-transporte', tipo: 'transporte', match: /v\.?\s*transp|ajuda\.?\s*transp/i }
      ]
      const profiles = parsed.employeeNames.map((name) => {
        const occurrences = parsed.months.flatMap((month) => month.employees.filter((item) => item.name === name))
        const roleHint = occurrences.find((item) => item.roleHint)?.roleHint || null
        const salary = latestComponent(parsed.months,name,/^salário$/i)
        const benefits = benefitDefs.map((definition) => ({ definition, component: latestComponent(parsed.months,name,definition.match) })).filter((item) => item.component)
        return { name, roleHint, salary, benefits, cargo: null }
      })
      const roleNames = [...new Set(profiles.map((item) => item.roleHint).filter(Boolean))]
      const roleSalaries = new Map()
      for (const role of roleNames) {
        const salary = mode(profiles.filter((item) => item.roleHint === role).map((item) => cents(item.salary?.value)))
        let cargo = this.db.db.prepare('SELECT * FROM cargos WHERE lower(nome)=lower(?)').get(role)
        if (!cargo) cargo = this.db.save('cargos',{ nome: role, salario_base_centavos: salary, ativo: 1 })
        else if (salary && !cargo.salario_base_centavos) cargo = this.db.save('cargos',{ ...cargo, salario_base_centavos: salary })
        roleSalaries.set(role,{ cargo, salary: salary || cargo.salario_base_centavos })
      }
      for (const profile of profiles) {
        if (!profile.roleHint && profile.salary) {
          const salary = cents(profile.salary.value)
          const nearest = [...roleSalaries.entries()].filter(([role,item]) => item.salary && /Encanador|Ajudante/i.test(role) && !/encarregado/i.test(role)).sort((a,b) => Math.abs(a[1].salary-salary)-Math.abs(b[1].salary-salary))[0]
          if (nearest && Math.abs(nearest[1].salary-salary) <= 20000) profile.roleHint = nearest[0]
        }
        profile.cargo = profile.roleHint ? roleSalaries.get(profile.roleHint)?.cargo : null
        let employee = this.db.db.prepare('SELECT * FROM funcionarios WHERE lower(trim(nome))=lower(trim(?)) AND deleted_at IS NULL').get(profile.name)
        const employeeData = { ...(employee||{}), empresa_id: company.id, nome: profile.name, status: employee?.status || 'ativo', salario_centavos: profile.salary ? cents(profile.salary.value) : (employee?.salario_centavos || 0), cargo_id: profile.cargo?.id || employee?.cargo_id || null, departamento: employee?.departamento || 'Operacional' }
        employee = this.db.save('funcionarios',employeeData)
        employeeMap.set(profile.name,employee)
        for (const benefit of profile.benefits) {
          let catalog = this.db.db.prepare('SELECT * FROM beneficios WHERE lower(nome)=lower(?)').get(benefit.definition.nome)
          if (!catalog) catalog = this.db.save('beneficios',{ nome: benefit.definition.nome, tipo: benefit.definition.tipo, valor_padrao_centavos: cents(benefit.component.value), ativo: 1 })
          this.db.db.prepare('INSERT INTO funcionario_beneficios(funcionario_id,beneficio_id,valor_centavos,inicio) VALUES (?,?,?,?) ON CONFLICT(funcionario_id,beneficio_id,inicio) DO UPDATE SET valor_centavos=excluded.valor_centavos').run(employee.id,catalog.id,cents(benefit.component.value),benefit.component.competencia+'-01')
          benefit.catalog = catalog
        }
      }
      for (const role of roleNames) {
        const roleProfiles = profiles.filter((item) => item.roleHint === role && item.cargo)
        const cargo = roleProfiles[0]?.cargo
        if (!cargo) continue
        for (const definition of benefitDefs) {
          const values = roleProfiles.flatMap((profile) => profile.benefits.filter((item) => item.definition.nome === definition.nome).map((item) => cents(item.component.value)))
          const value = mode(values)
          const catalog = roleProfiles.flatMap((profile) => profile.benefits).find((item) => item.definition.nome === definition.nome)?.catalog
          if (catalog && value) this.db.db.prepare("INSERT INTO cargo_beneficios(cargo_id,beneficio_id,valor_centavos,quinzena,natureza,ativo) VALUES (?,?,?,1,'credito',1) ON CONFLICT(cargo_id,beneficio_id) DO UPDATE SET valor_centavos=CASE WHEN cargo_beneficios.valor_centavos=0 THEN excluded.valor_centavos ELSE cargo_beneficios.valor_centavos END,ativo=1").run(cargo.id,catalog.id,value)
        }
      }
      let imported = 0
      const reconciliation = []
      const rawInsert = this.db.db.prepare('INSERT INTO importacao_linhas(importacao_id,competencia,celula,tipo,nome_origem,valor_centavos,dados_brutos,entidade_tipo,entidade_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)')
      for (const month of parsed.months) {
        let folha = this.db.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id=? AND competencia=?').get(company.id, month.competencia)
        if (!folha) folha = this.db.save('folhas_pagamento', { empresa_id: company.id, competencia: month.competencia, status: 'aberta' })
        let payrollTotal = 0
        for (const emp of month.employees) {
          const employee = employeeMap.get(emp.name)
          const payable = emp.components.find((c) => /a pagar/i.test(c.label))
          for (const component of emp.components) {
            const nature = /desc|falta|vale/i.test(component.label) ? 'desconto' : 'credito'
            const cell = encodeCell({ r: emp.row - 1, c: component.col })
            const raw = rawInsert.run(importRow.id, month.competencia, cell, 'folha', emp.name, cents(component.value), JSON.stringify(component), 'funcionarios', employee.id, 'importado')
            this.db.save('folha_lancamentos', { folha_id: folha.id, funcionario_id: employee.id, tipo: component.label.toLowerCase().replace(/[^a-z0-9]+/gi,'_'), descricao: component.label, natureza: nature, valor_centavos: Math.abs(cents(component.value)), importacao_linha_id: Number(raw.lastInsertRowid) })
            imported++
          }
          if (payable && payable.value > 0) {
            payrollTotal += cents(payable.value)
            this.db.save('contas', { tipo: 'pagar', empresa_id: company.id, categoria_id: categories['Folha de pagamento'], descricao: `Folha ${emp.name}`, competencia: month.competencia, vencimento: `${month.competencia}-05`, valor_bruto_centavos: cents(payable.value), valor_centavos: cents(payable.value), status: 'pendente', origem_tipo: 'importacao_2026', origem_id: importRow.id })
          }
        }
        for (const expense of month.expenses) {
          const category = /fgts|inss|darf|seconci|pis|cofins/i.test(expense.name) ? categories['Encargos trabalhistas'] : /ferrament/i.test(expense.name) ? categories['Ferramentas'] : /combust/i.test(expense.name) ? categories['Combustível'] : /seguro/i.test(expense.name) ? categories['Seguros'] : /tarifa/i.test(expense.name) ? categories['Tarifas bancárias'] : categories['Outras despesas']
          const account = this.db.save('contas', { tipo: 'pagar', empresa_id: company.id, categoria_id: category, descricao: expense.name, competencia: month.competencia, vencimento: `${month.competencia}-20`, valor_bruto_centavos: cents(expense.value), valor_centavos: cents(expense.value), status: 'pendente', origem_tipo: 'importacao_2026', origem_id: importRow.id })
            rawInsert.run(importRow.id, month.competencia, encodeCell({ r: expense.row - 1, c: month.startCol + 1 }), 'despesa', expense.name, cents(expense.value), JSON.stringify(expense), 'contas', account.id, 'importado'); imported++
        }
        for (const revenue of month.revenues) {
          const account = this.db.save('contas', { tipo: 'receber', empresa_id: company.id, categoria_id: categories['Receitas de contratos'], descricao: revenue.name, competencia: month.competencia, vencimento: `${month.competencia}-10`, valor_bruto_centavos: cents(revenue.value), valor_centavos: cents(revenue.value), status: 'pendente', origem_tipo: 'importacao_2026', origem_id: importRow.id })
            rawInsert.run(importRow.id, month.competencia, encodeCell({ r: revenue.row - 1, c: month.startCol + 1 }), 'receita', revenue.name, cents(revenue.value), JSON.stringify(revenue), 'contas', account.id, 'importado'); imported++
        }
        const actualRevenue = month.revenues.reduce((sum, item) => sum + cents(item.value), 0)
        const actualExpense = month.expenses.reduce((sum, item) => sum + cents(item.value), 0) + payrollTotal
        reconciliation.push({ competencia: month.competencia, esperado_receitas: month.expectedRevenue, importado_receitas: actualRevenue, diferenca_receitas: actualRevenue - month.expectedRevenue, esperado_despesas: month.expectedExpense, importado_despesas: actualExpense, diferenca_despesas: actualExpense - month.expectedExpense })
      }
      this.db.db.prepare("UPDATE importacoes SET status='concluida',resumo=?,concluida_em=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify({ imported, reconciliation }), importRow.id)
      this.pending.delete(token)
      return { importacao_id: importRow.id, imported, employees: employeeMap.size, reconciliation }
    })()
  }
}

module.exports = { ImportService, parseSheet2026, cents, normalizeName, parseEmployeeIdentity }


