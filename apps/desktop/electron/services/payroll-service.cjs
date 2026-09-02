class PayrollService {
  constructor({ db }) { this.db = db }

  ensureSheet(employeeId, competencia) {
    const employee = this.db.get('funcionarios', Number(employeeId))
    if (!employee || employee.status !== 'ativo') throw new Error('Funcionário ativo não encontrado.')
    const cargo = employee.cargo_id ? this.db.get('cargos', employee.cargo_id) : null
    let sheet = this.db.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id IS ? AND competencia=?').get(employee.empresa_id || null, competencia)
    if (!sheet) sheet = this.db.save('folhas_pagamento', { empresa_id: employee.empresa_id || null, competencia, status: 'aberta' })
    const paid = this.db.db.prepare("SELECT COUNT(*) total FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND status='pago'").get(employee.id, competencia).total
    if (!paid) this.syncFixed(sheet, employee, cargo)
    return { employee, cargo, sheet }
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
    const find = this.db.db.prepare("SELECT id FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND tipo=? AND origem='cargo'")
    const insert = this.db.db.prepare("INSERT INTO folha_lancamentos(folha_id,funcionario_id,tipo,descricao,natureza,quinzena,valor_centavos,origem,editavel,status,updated_at) VALUES (?,?,?,?,?,?,?,?,0,'pendente',CURRENT_TIMESTAMP)")
    const update = this.db.db.prepare("UPDATE folha_lancamentos SET descricao=?,natureza=?,quinzena=?,valor_centavos=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pendente'")
    for (const item of fixed) {
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
    return this.db.save('folha_lancamentos', data)
  }

  removeVariable(id) {
    const current = this.db.get('folha_lancamentos', Number(id))
    if (!current?.editavel || current.status === 'pago') throw new Error('Este lançamento não pode ser excluído.')
    this.db.db.prepare('DELETE FROM folha_lancamentos WHERE id=?').run(current.id)
    return true
  }

  confirm(payload) {
    const { employee, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const quinzena = Number(payload.quinzena)
    const existing = this.db.db.prepare("SELECT id FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND quinzena=? AND status='pago'").get(employee.id, payload.competencia, quinzena)
    if (existing) throw new Error('Esta quinzena já foi confirmada.')
    const rows = this.db.db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").all(sheet.id, employee.id, quinzena)
    const credits = rows.filter((x) => x.natureza === 'credito').reduce((sum, x) => sum + x.valor_centavos, 0)
    const discounts = rows.filter((x) => x.natureza === 'desconto').reduce((sum, x) => sum + x.valor_centavos, 0)
    const amount = Math.max(0, credits - discounts)
    return this.db.db.transaction(() => {
      const payment = this.db.save('pagamentos_funcionario', { funcionario_id: employee.id, folha_id: sheet.id, competencia: payload.competencia, quinzena, valor_centavos: amount, data: payload.data, status: 'pago', observacoes: payload.observacoes || null, forma_pagamento: payload.forma_pagamento || 'PIX', confirmado_em: new Date().toISOString() })
      this.db.db.prepare("UPDATE folha_lancamentos SET status='pago',updated_at=CURRENT_TIMESTAMP WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").run(sheet.id, employee.id, quinzena)
      return payment
    })()
  }

  pending(competencia) {
    const employees = this.db.db.prepare("SELECT * FROM funcionarios WHERE deleted_at IS NULL AND status='ativo' ORDER BY nome COLLATE NOCASE").all()
    const result = []
    for (const employee of employees) {
      const data = this.getEmployee({ funcionario_id: employee.id, competencia })
      const paid = new Set(data.payments.filter((item) => item.status === 'pago').map((item) => item.quinzena))
      for (const quinzena of [1, 2]) {
        if (paid.has(quinzena)) continue
        const rows = data.launches.filter((item) => item.quinzena === quinzena)
        if (quinzena === 2 && !rows.length) continue
        const credits = rows.filter((item) => item.natureza === 'credito').reduce((sum, item) => sum + item.valor_centavos, 0)
        const discounts = rows.filter((item) => item.natureza === 'desconto').reduce((sum, item) => sum + item.valor_centavos, 0)
        result.push({ funcionario_id: employee.id, funcionario_nome: employee.nome, cargo_nome: data.cargo?.nome || 'Sem cargo', competencia, quinzena, valor_centavos: Math.max(0, credits - discounts), status: 'pendente' })
      }
    }
    return result
  }
}

module.exports = { PayrollService }



