const { payrollAmount, payrollPendingRows, buildPayrollOverview, createPayrollImportEngine, classifyPayrollOverviewLaunch, paymentStatus } = require('./domain-core.cjs')


class PayrollService {
  constructor({ db }) {
    this.db = db
    this.importEngine = createPayrollImportEngine({
      db: db.db,
      save: (table,data) => db.save(table,data),
      get: (table,id) => db.get(table,id),
      ensureSheet: (employeeId,competencia) => this.ensureSheet(employeeId,competencia)
    })
  }

  ensureSheet(employeeId, competencia) {
    const employee = this.db.get('funcionarios', Number(employeeId))
    if (!employee || employee.status !== 'ativo') throw new Error('Funcionário ativo não encontrado.')
    const cargo = employee.cargo_id ? this.db.get('cargos', employee.cargo_id) : null
    let sheet = this.db.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id IS ? AND competencia=?').get(employee.empresa_id || null, competencia)
    if (!sheet) sheet = this.db.save('folhas_pagamento', { empresa_id: employee.empresa_id || null, competencia, status: 'aberta' })
    const companyEmployees = this.db.db.prepare("SELECT * FROM funcionarios WHERE empresa_id IS ? AND deleted_at IS NULL AND status='ativo' ORDER BY id").all(employee.empresa_id || null)
    for (const person of companyEmployees) {
      const paid = this.db.db.prepare("SELECT COUNT(*) total FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND status='pago'").get(person.id, competencia).total
      if (!paid) this.syncFixed(sheet, person, person.cargo_id ? this.db.get('cargos', person.cargo_id) : null)
    }
    sheet = this.syncPayrollAccount(sheet)
    return { employee, cargo, sheet }
  }

  payrollAccountAmount(sheetId) {
    const rows = this.db.db.prepare("SELECT natureza,valor_centavos FROM folha_lancamentos WHERE folha_id=? AND quinzena IN (1,2)").all(sheetId)
    return payrollAmount(rows)
  }

  syncPayrollAccount(sheet) {
    const companyId = Number(sheet?.empresa_id || 0)
    if (!companyId) return sheet
    const amount = this.payrollAccountAmount(sheet.id)
    if (amount <= 0) return sheet
    let category = this.db.db.prepare("SELECT * FROM categorias_financeiras WHERE lower(nome)=lower('Folha de pagamento') LIMIT 1").get()
    if (!category) category = this.db.save('categorias_financeiras', { nome:'Folha de pagamento', natureza:'despesa', grupo_dre:'pessoal', ativa:1 })
    let account = sheet.conta_id ? this.db.get('contas', sheet.conta_id) : null
    if (!account) account = this.db.db.prepare("SELECT * FROM contas WHERE empresa_id=? AND origem_tipo='folha_pagamento' AND origem_id=? AND deleted_at IS NULL LIMIT 1").get(companyId, sheet.id)
    const paid = account ? Number(this.db.db.prepare('SELECT COALESCE(SUM(valor_centavos),0) total FROM pagamentos_conta WHERE conta_id=?').get(account.id).total || 0) : 0
    const data = {
      tipo:'pagar',
      empresa_id:companyId,
      categoria_id:category.id,
      descricao:`Folha ${sheet.competencia}`,
      competencia:sheet.competencia,
      vencimento:`${sheet.competencia}-05`,
      valor_bruto_centavos:amount,
      valor_centavos:amount,
      status:paid>0?paymentStatus({tipo:'pagar',valor_centavos:amount},paid):'pendente',
      data_efetiva:paid>0?(account?.data_efetiva||null):null,
      origem_tipo:'folha_pagamento',
      origem_id:sheet.id
    }
    account = this.db.save('contas', account ? { ...data, id:account.id } : data)
    if (Number(sheet.conta_id || 0) !== Number(account.id)) {
      this.db.db.prepare('UPDATE folhas_pagamento SET conta_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(account.id, sheet.id)
    }
    return this.db.get('folhas_pagamento', sheet.id)
  }

  recordPayrollAccountPayment(sheet, payment) {
    if (!sheet?.conta_id || Number(payment?.valor_centavos || 0) <= 0) return
    const account = this.db.get('contas', sheet.conta_id)
    if (!account) return
    const marker = `RH pagamento funcionário #${payment.id}`
    const exists = this.db.db.prepare('SELECT id FROM pagamentos_conta WHERE conta_id=? AND observacoes=?').get(account.id, marker)
    if (!exists) {
      this.db.db.prepare('INSERT INTO pagamentos_conta(conta_id,valor_centavos,data,forma_pagamento,observacoes) VALUES (?,?,?,?,?)')
        .run(account.id, payment.valor_centavos, payment.data, payment.forma_pagamento || 'PIX', marker)
    }
    const paid = Number(this.db.db.prepare('SELECT COALESCE(SUM(valor_centavos),0) total FROM pagamentos_conta WHERE conta_id=?').get(account.id).total || 0)
    const status = paymentStatus(account, paid)
    this.db.db.prepare('UPDATE contas SET status=?,data_efetiva=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, payment.data, account.id)
  }

  syncFixed(sheet, employee, cargo) {
    const fixed = []
    const salary = employee.salario_centavos || cargo?.salario_base_centavos || 0
    if (salary) fixed.push({ tipo: 'salario', descricao: 'Salário base', valor: salary, natureza: 'credito', quinzena: 1 })
    const benefitMap = new Map()
    if (cargo) {
      const benefits = this.db.db.prepare(`SELECT cb.*,b.nome,b.tipo FROM cargo_beneficios cb JOIN beneficios b ON b.id=cb.beneficio_id WHERE cb.cargo_id=? AND cb.ativo=1 AND b.ativo=1`).all(cargo.id)
      for (const benefit of benefits) benefitMap.set(benefit.beneficio_id,{ tipo: `beneficio_${benefit.beneficio_id}`, descricao: benefit.nome, valor: benefit.valor_centavos, natureza: benefit.natureza, quinzena: benefit.quinzena })
    }
    const overrides = this.db.db.prepare(`SELECT fb.*,b.nome,b.tipo FROM funcionario_beneficios fb JOIN beneficios b ON b.id=fb.beneficio_id WHERE fb.funcionario_id=? AND b.ativo=1 AND (fb.inicio IS NULL OR substr(fb.inicio,1,7)<=?) AND (fb.fim IS NULL OR substr(fb.fim,1,7)>=?) ORDER BY fb.beneficio_id,fb.inicio DESC`).all(employee.id,sheet.competencia,sheet.competencia)
    for (const benefit of overrides) if (!benefitMap.has('employee-'+benefit.beneficio_id)) {
      benefitMap.set('employee-'+benefit.beneficio_id,{ tipo: `beneficio_${benefit.beneficio_id}`, descricao: benefit.nome, valor: benefit.valor_centavos, natureza: 'credito', quinzena: 1 })
      benefitMap.delete(benefit.beneficio_id)
    }
    for (const benefit of benefitMap.values()) fixed.push(benefit)
    const benefitCatalog = new Map(this.db.db.prepare("SELECT id,nome,tipo FROM beneficios WHERE ativo=1").all().map(item=>[Number(item.id),item]))
    const importedKeys = new Set(this.db.db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND origem='importacao'").all(sheet.id,employee.id).map(item=>classifyPayrollOverviewLaunch(item,benefitCatalog)))
    const find = this.db.db.prepare("SELECT id FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND tipo=? AND origem='cargo'")
    const insert = this.db.db.prepare("INSERT INTO folha_lancamentos(folha_id,funcionario_id,tipo,descricao,natureza,quinzena,valor_centavos,origem,editavel,status,updated_at) VALUES (?,?,?,?,?,?,?,?,0,'pendente',CURRENT_TIMESTAMP)")
    const update = this.db.db.prepare("UPDATE folha_lancamentos SET descricao=?,natureza=?,quinzena=?,valor_centavos=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pendente' AND importacao_linha_id IS NULL")
    for (const item of fixed) {
      const key = classifyPayrollOverviewLaunch(item,benefitCatalog)
      if (importedKeys.has(key)) continue
      const current = find.get(sheet.id, employee.id, item.tipo)
      if (current) update.run(item.descricao, item.natureza, item.quinzena, item.valor, current.id)
      else insert.run(sheet.id, employee.id, item.tipo, item.descricao, item.natureza, item.quinzena, item.valor, 'cargo')
    }
  }

  getEmployee(payload) {
    const { employee, cargo, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const launches = this.db.db.prepare('SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? ORDER BY quinzena,editavel,tipo,id').all(sheet.id, employee.id)
    const payments = this.db.db.prepare('SELECT * FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? ORDER BY quinzena').all(employee.id, payload.competencia)
    return { employee, cargo, sheet, launches, payments }
  }

  saveVariable(payload) {
    const { employee, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const data = {
      id: payload.id,
      folha_id: sheet.id,
      funcionario_id: employee.id,
      tipo: payload.tipo,
      descricao: payload.descricao,
      natureza: payload.natureza,
      quinzena: Number(payload.quinzena),
      valor_centavos: Math.max(0, Number(payload.valor_centavos) || 0),
      quantidade: payload.quantidade || null,
      data: payload.data || null,
      origem: 'variavel', editavel: 1, status: 'pendente'
    }
    if (data.id) {
      const current = this.db.get('folha_lancamentos', data.id)
      if (!current?.editavel || current.status === 'pago') throw new Error('Este lançamento não pode ser alterado.')
    }
    const saved = this.db.save('folha_lancamentos', data)
    this.syncPayrollAccount(sheet)
    return saved
  }

  removeVariable(id) {
    const current = this.db.get('folha_lancamentos', Number(id))
    if (!current?.editavel || current.status === 'pago') throw new Error('Este lançamento não pode ser excluído.')
    const sheet = this.db.get('folhas_pagamento', current.folha_id)
    this.db.db.prepare('DELETE FROM folha_lancamentos WHERE id=?').run(current.id)
    if (sheet) this.syncPayrollAccount(sheet)
    return true
  }

  confirm(payload) {
    const { employee, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const quinzena = Number(payload.quinzena)
    const existing = this.db.db.prepare("SELECT id FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND quinzena=? AND status='pago'").get(employee.id, payload.competencia, quinzena)
    if (existing) throw new Error('Esta quinzena já foi confirmada.')
    const rows = this.db.db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").all(sheet.id, employee.id, quinzena)
    const amount = payrollAmount(rows)
    return this.db.db.transaction(() => {
      const payment = this.db.save('pagamentos_funcionario', { funcionario_id: employee.id, folha_id: sheet.id, competencia: payload.competencia, quinzena, valor_centavos: amount, data: payload.data, status: 'pago', observacoes: payload.observacoes || null, forma_pagamento: payload.forma_pagamento || 'PIX', confirmado_em: new Date().toISOString() })
      this.db.db.prepare("UPDATE folha_lancamentos SET status='pago',updated_at=CURRENT_TIMESTAMP WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").run(sheet.id, employee.id, quinzena)
      this.recordPayrollAccountPayment(sheet, payment)
      return payment
    })()
  }

  overview(payload = {}) {
    const competencia = String(payload.competencia || '')
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error('Competência inválida para a visão geral da folha.')
    const empresaId = Number(payload.empresa_id) || null
    const obraId = Number(payload.obra_id) || null

    const employeeWhere = ["deleted_at IS NULL", "status='ativo'"]
    const employeeParams = []
    if (empresaId) { employeeWhere.push('empresa_id=?'); employeeParams.push(empresaId) }
    if (obraId) { employeeWhere.push('obra_atual_id=?'); employeeParams.push(obraId) }
    const employees = this.db.db.prepare(`SELECT * FROM funcionarios WHERE ${employeeWhere.join(' AND ')} ORDER BY nome COLLATE NOCASE`).all(...employeeParams)
    const benefits = this.db.db.prepare('SELECT * FROM beneficios WHERE ativo=1 ORDER BY nome COLLATE NOCASE').all()
    const employeeEntries = employees.map(employee => {
      const data = this.getEmployee({ funcionario_id: employee.id, competencia })
      return { employee: data.employee, cargo: data.cargo, launches: data.launches }
    })

    const accountWhere = ["c.deleted_at IS NULL", "c.tipo='pagar'", 'c.competencia=?']
    const accountParams = [competencia]
    if (empresaId) { accountWhere.push('c.empresa_id=?'); accountParams.push(empresaId) }
    if (obraId) { accountWhere.push('c.obra_id=?'); accountParams.push(obraId) }
    const accounts = this.db.db.prepare(`
      SELECT c.*, cf.nome AS categoria_nome
      FROM contas c
      LEFT JOIN categorias_financeiras cf ON cf.id=c.categoria_id
      WHERE ${accountWhere.join(' AND ')}
      ORDER BY c.vencimento, c.descricao COLLATE NOCASE, c.id
    `).all(...accountParams)

    return buildPayrollOverview({
      competencia,
      empresa_id: empresaId,
      obra_id: obraId,
      employeeEntries,
      accounts,
      benefits
    })
  }

  importPreview(payload) { return this.importEngine.preview(payload) }
  importCommit(payload) { const result=this.importEngine.commit(payload);const sheet=this.db.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id IS ? AND competencia=?').get(payload.empresa_id||null,payload.competencia);if(sheet)this.syncPayrollAccount(sheet);return result }
  importHistory(limit) { return this.importEngine.history(limit) }
  importUndo(importacaoId) { const result=this.importEngine.undo(importacaoId);const sheets=this.db.db.prepare('SELECT * FROM folhas_pagamento').all();for(const sheet of sheets)this.syncPayrollAccount(sheet);return result }

  pending(competencia) {
    const employees = this.db.db.prepare("SELECT * FROM funcionarios WHERE deleted_at IS NULL AND status='ativo' ORDER BY nome COLLATE NOCASE").all()
    const result = []
    for (const employee of employees) {
      const data = this.getEmployee({ funcionario_id: employee.id, competencia })
      result.push(...payrollPendingRows({ employee, cargo: data.cargo, competencia, launches: data.launches, payments: data.payments }))
    }
    return result
  }
}

module.exports = { PayrollService }



