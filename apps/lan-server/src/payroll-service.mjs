import domainCore from './domain-core.cjs'
const { payrollAmount, payrollPendingRows, buildPayrollOverview, createPayrollImportEngine, classifyPayrollOverviewLaunch } = domainCore
import { ConcurrencyService } from './concurrency-service.mjs'

export class PayrollService {
  constructor({ repository, now = () => new Date().toISOString() }) {
    if (!repository?.connection) throw new Error('Repositório LAN inválido para Folha.')
    this.repository = repository
    this.now = now
    this.concurrency = new ConcurrencyService({ db: repository.connection() })
    this.importEngine = createPayrollImportEngine({
      db: repository.connection(),
      save: (table,data) => repository.save(table,data),
      get: (table,id) => repository.get(table,id),
      ensureSheet: (employeeId,competencia) => this.ensureSheet(employeeId,competencia)
    })
  }

  get db() { return this.repository.connection() }

  ensureSheet(employeeId, competencia) {
    const employee = this.repository.get('funcionarios', Number(employeeId))
    if (!employee || employee.deleted_at || employee.status !== 'ativo') throw new Error('Funcionário ativo não encontrado.')
    const cargo = employee.cargo_id ? this.repository.get('cargos', employee.cargo_id) : null
    let sheet = this.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id=? AND competencia=?').get(employee.empresa_id, competencia)
    const created = !sheet
    if (!sheet) sheet = this.repository.save('folhas_pagamento', { empresa_id: employee.empresa_id, competencia, status: 'aberta' })
    const paid = Number(this.db.prepare("SELECT COUNT(*) total FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND status='pago'").get(employee.id, competencia)?.total || 0)
    if (!paid) this.syncFixed(sheet, employee, cargo)
    const revision = this.concurrency.current('folhas_pagamento', sheet.id) || this.concurrency.initialize('folhas_pagamento', sheet.id)
    return { employee, cargo, sheet: { ...sheet, revision }, created }
  }

  syncFixed(sheet, employee, cargo) {
    const fixed = []
    const salary = Number(employee.salario_centavos || cargo?.salario_base_centavos || 0)
    if (salary) fixed.push({ tipo: 'salario', descricao: 'Salário base', valor: salary, natureza: 'credito', quinzena: 1 })

    const benefitMap = new Map()
    if (cargo) {
      const benefits = this.db.prepare(`
        SELECT cb.*,b.nome,b.tipo
        FROM cargo_beneficios cb JOIN beneficios b ON b.id=cb.beneficio_id
        WHERE cb.empresa_id=? AND cb.cargo_id=? AND cb.ativo=1 AND b.ativo=1
      `).all(employee.empresa_id, cargo.id)
      for (const benefit of benefits) {
        benefitMap.set(benefit.beneficio_id, {
          tipo: `beneficio_${benefit.beneficio_id}`,
          descricao: benefit.nome,
          valor: benefit.valor_centavos,
          natureza: benefit.natureza,
          quinzena: benefit.quinzena
        })
      }
    }

    const overrides = this.db.prepare(`
      SELECT fb.*,b.nome,b.tipo
      FROM funcionario_beneficios fb JOIN beneficios b ON b.id=fb.beneficio_id
      WHERE fb.empresa_id=? AND fb.funcionario_id=? AND b.ativo=1
        AND (fb.inicio IS NULL OR substr(fb.inicio,1,7)<=?)
        AND (fb.fim IS NULL OR substr(fb.fim,1,7)>=?)
      ORDER BY fb.beneficio_id,fb.inicio DESC
    `).all(employee.empresa_id, employee.id, sheet.competencia, sheet.competencia)

    const overridden = new Set()
    for (const benefit of overrides) {
      if (overridden.has(benefit.beneficio_id)) continue
      overridden.add(benefit.beneficio_id)
      benefitMap.set(benefit.beneficio_id, {
        tipo: `beneficio_${benefit.beneficio_id}`,
        descricao: benefit.nome,
        valor: benefit.valor_centavos,
        natureza: 'credito',
        quinzena: 1
      })
    }

    for (const benefit of benefitMap.values()) fixed.push(benefit)

    const benefitCatalog = new Map(this.db.prepare("SELECT id,nome,tipo FROM beneficios WHERE ativo=1 AND empresa_id=?").all(employee.empresa_id).map(item=>[Number(item.id),item]))
    const importedKeys = new Set(this.db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND origem='importacao'").all(sheet.id,employee.id).map(item=>classifyPayrollOverviewLaunch(item,benefitCatalog)))
    const find = this.db.prepare("SELECT id FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND tipo=? AND origem='cargo'")
    const insert = this.db.prepare(`
      INSERT INTO folha_lancamentos(
        empresa_id,folha_id,funcionario_id,tipo,descricao,natureza,quinzena,valor_centavos,origem,editavel,status,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,0,'pendente',CURRENT_TIMESTAMP)
    `)
    const update = this.db.prepare("UPDATE folha_lancamentos SET descricao=?,natureza=?,quinzena=?,valor_centavos=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pendente'")
    for (const item of fixed) {
      const key = classifyPayrollOverviewLaunch(item,benefitCatalog)
      if (importedKeys.has(key)) continue
      const current = find.get(sheet.id, employee.id, item.tipo)
      if (current) update.run(item.descricao, item.natureza, item.quinzena, item.valor, current.id)
      else insert.run(employee.empresa_id, sheet.id, employee.id, item.tipo, item.descricao, item.natureza, item.quinzena, item.valor, 'cargo')
    }
  }

  getEmployee(payload) {
    const { employee, cargo, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const launches = this.db.prepare('SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? ORDER BY quinzena,editavel,tipo,id').all(sheet.id, employee.id)
    const payments = this.db.prepare('SELECT * FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? ORDER BY quinzena').all(employee.id, payload.competencia)
    return { employee, cargo, sheet, launches, payments }
  }

  saveVariable(payload) {
    const { employee, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const data = {
      id: payload.id,
      empresa_id: employee.empresa_id,
      folha_id: sheet.id,
      funcionario_id: employee.id,
      tipo: payload.tipo,
      descricao: payload.descricao,
      natureza: payload.natureza,
      quinzena: Number(payload.quinzena),
      valor_centavos: Math.max(0, Number(payload.valor_centavos) || 0),
      quantidade: payload.quantidade || null,
      data: payload.data || null,
      origem: 'variavel',
      editavel: 1,
      status: 'pendente'
    }
    if (data.id) {
      const current = this.repository.get('folha_lancamentos', data.id)
      if (!current || Number(current.empresa_id) !== Number(employee.empresa_id) || !current.editavel || current.status === 'pago') {
        throw new Error('Este lançamento não pode ser alterado.')
      }
    }
    return this.repository.save('folha_lancamentos', data)
  }

  removeVariable(id) {
    const current = this.repository.get('folha_lancamentos', Number(id))
    if (!current?.editavel || current.status === 'pago') throw new Error('Este lançamento não pode ser excluído.')
    this.db.prepare('DELETE FROM folha_lancamentos WHERE id=?').run(current.id)
    return true
  }

  confirm(payload) {
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const { employee, sheet, created } = this.ensureSheet(payload.funcionario_id, payload.competencia)
      if (!created) {
        this.concurrency.assertExpected('folhas_pagamento', sheet.id, payload.expectedRevision, sheet)
      }

      const quinzena = Number(payload.quinzena)
      const existing = this.db.prepare("SELECT id FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND quinzena=? AND status='pago'").get(employee.id, payload.competencia, quinzena)
      if (existing) throw new Error('Esta quinzena já foi confirmada.')

      const rows = this.db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").all(sheet.id, employee.id, quinzena)
      const amount = payrollAmount(rows)

      const payment = this.repository.save('pagamentos_funcionario', {
        empresa_id: employee.empresa_id,
        funcionario_id: employee.id,
        folha_id: sheet.id,
        competencia: payload.competencia,
        quinzena,
        valor_centavos: amount,
        data: payload.data,
        status: 'pago',
        observacoes: payload.observacoes || null,
        forma_pagamento: payload.forma_pagamento || 'PIX',
        confirmado_em: this.now()
      })
      this.db.prepare("UPDATE folha_lancamentos SET status='pago',updated_at=CURRENT_TIMESTAMP WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").run(sheet.id, employee.id, quinzena)
      const sheetRevision = created ? sheet.revision : this.concurrency.bump('folhas_pagamento', sheet.id)
      this.db.exec('COMMIT;')
      return { ...payment, sheetRevision }
    } catch (error) {
      try { this.db.exec('ROLLBACK;') } catch {}
      throw error
    }
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
    const employees = this.db.prepare(`SELECT * FROM funcionarios WHERE ${employeeWhere.join(' AND ')} ORDER BY nome COLLATE NOCASE`).all(...employeeParams)

    const benefitWhere = ['ativo=1']
    const benefitParams = []
    if (empresaId) { benefitWhere.push('empresa_id=?'); benefitParams.push(empresaId) }
    const benefits = this.db.prepare(`SELECT * FROM beneficios WHERE ${benefitWhere.join(' AND ')} ORDER BY nome COLLATE NOCASE`).all(...benefitParams)
    const employeeEntries = employees.map(employee => {
      const data = this.getEmployee({ funcionario_id: employee.id, competencia })
      return { employee: data.employee, cargo: data.cargo, launches: data.launches }
    })

    const accountWhere = ["c.deleted_at IS NULL", "c.tipo='pagar'", 'c.competencia=?']
    const accountParams = [competencia]
    if (empresaId) { accountWhere.push('c.empresa_id=?'); accountParams.push(empresaId) }
    if (obraId) { accountWhere.push('c.obra_id=?'); accountParams.push(obraId) }
    const accounts = this.db.prepare(`
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
  importCommit(payload) { return this.importEngine.commit(payload) }
  importHistory(limit) { return this.importEngine.history(limit) }
  importUndo(importacaoId) { return this.importEngine.undo(importacaoId) }

  pending(competencia) {
    const employees = this.db.prepare("SELECT * FROM funcionarios WHERE deleted_at IS NULL AND status='ativo' ORDER BY nome COLLATE NOCASE").all()
    const result = []
    for (const employee of employees) {
      const data = this.getEmployee({ funcionario_id: employee.id, competencia })
      result.push(...payrollPendingRows({ employee, cargo: data.cargo, competencia, launches: data.launches, payments: data.payments }))
    }
    return result
  }
}
