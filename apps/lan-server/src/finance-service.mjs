function paymentStatus(account, paid) {
  return paid >= Number(account.valor_centavos || 0)
    ? (account.tipo === 'pagar' ? 'pago' : 'recebido')
    : 'parcialmente_pago'
}

export class FinanceService {
  constructor({ repository, now = Date.now }) {
    this.repository = repository
    this.now = now
  }

  get db() {
    if (!this.repository?.connection) throw new Error('Repositório financeiro central indisponível.')
    return this.repository.connection()
  }

  paymentResult(account, paymentRow) {
    const paid = Number(this.db.prepare('SELECT COALESCE(SUM(valor_centavos),0) AS total FROM pagamentos_conta WHERE conta_id=? AND id<=?').get(account.id, paymentRow.id)?.total || 0)
    return {
      ...account,
      status: paymentStatus(account, paid),
      data_efetiva: paymentRow.data,
      pago_centavos: paid
    }
  }

  accountPayment(contaId, payment, requestId) {
    const id = Number(contaId)
    const key = String(requestId || '').trim()
    if (!key) throw new Error('Identificador idempotente do pagamento não informado.')

    const existing = this.db.prepare('SELECT * FROM pagamentos_conta WHERE request_id=?').get(key)
    if (existing) {
      if (Number(existing.conta_id) !== id) throw new Error('Identificador de pagamento já utilizado em outra conta.')
      const account = this.repository.get('contas', id)
      if (!account) throw new Error('Conta não encontrada.')
      return this.paymentResult(account, existing)
    }

    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const account = this.repository.get('contas', id)
      if (!account || account.deleted_at) throw new Error('Conta não encontrada.')
      const value = Number(payment?.valor_centavos)
      if (!Number.isInteger(value) || value <= 0) throw new Error('Valor de pagamento inválido.')
      const date = String(payment?.data || '').trim()
      if (!date) throw new Error('Data do pagamento não informada.')

      const inserted = this.db.prepare(`
        INSERT INTO pagamentos_conta(conta_id,valor_centavos,data,forma_pagamento,observacoes,request_id)
        VALUES (?,?,?,?,?,?)
      `).run(account.id, value, date, payment?.forma_pagamento || null, payment?.observacoes || null, key)
      const paymentRow = this.db.prepare('SELECT * FROM pagamentos_conta WHERE id=?').get(Number(inserted.lastInsertRowid))
      const paid = Number(this.db.prepare('SELECT COALESCE(SUM(valor_centavos),0) AS total FROM pagamentos_conta WHERE conta_id=?').get(account.id)?.total || 0)
      const status = paymentStatus(account, paid)
      this.db.prepare('UPDATE contas SET status=?,data_efetiva=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, date, account.id)
      const result = { ...this.repository.get('contas', account.id), pago_centavos: paid }
      this.db.exec('COMMIT;')
      return result
    } catch (error) {
      try { this.db.exec('ROLLBACK;') } catch {}
      if (/UNIQUE constraint failed: pagamentos_conta\.request_id/i.test(String(error?.message || ''))) {
        const replay = this.db.prepare('SELECT * FROM pagamentos_conta WHERE request_id=?').get(key)
        if (replay && Number(replay.conta_id) === id) {
          const account = this.repository.get('contas', id)
          if (account) return this.paymentResult(account, replay)
        }
      }
      throw error
    }
  }

  dre({ competencia, ano, empresa_id, obra_id } = {}) {
    const clauses = ['c.deleted_at IS NULL', "c.status!='cancelado'"]
    const params = {}
    if (competencia) {
      clauses.push('c.competencia=@competencia')
      params.competencia = competencia
    } else {
      clauses.push('substr(c.competencia,1,4)=@ano')
      params.ano = String(ano || new Date(this.now()).getFullYear())
    }
    if (empresa_id) {
      clauses.push('c.empresa_id=@empresa_id')
      params.empresa_id = Number(empresa_id)
    }
    if (obra_id) {
      clauses.push('c.obra_id=@obra_id')
      params.obra_id = Number(obra_id)
    }
    return this.db.prepare(`
      SELECT c.competencia,c.tipo,COALESCE(cf.grupo_dre,'operacional') grupo,COALESCE(cf.nome,'Sem categoria') categoria,SUM(c.valor_centavos) valor
      FROM contas c LEFT JOIN categorias_financeiras cf ON cf.id=c.categoria_id
      WHERE ${clauses.join(' AND ')}
      GROUP BY c.competencia,c.tipo,grupo,categoria
      ORDER BY c.competencia,c.tipo,categoria
    `).all(params)
  }

  dashboard(filters = {}) {
    const competencia = filters.competencia || new Date(this.now()).toISOString().slice(0, 7)
    const companyClause = filters.empresa_id ? ' AND empresa_id=@empresa_id' : ''
    const companyParams = filters.empresa_id ? { empresa_id: Number(filters.empresa_id) } : {}
    const financeParams = { competencia, ...companyParams }
    const sums = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='receber' AND status!='cancelado' THEN valor_centavos ELSE 0 END),0) receitas,
        COALESCE(SUM(CASE WHEN tipo='pagar' AND status!='cancelado' THEN valor_centavos ELSE 0 END),0) despesas,
        COALESCE(SUM(CASE WHEN tipo='pagar' AND status IN ('pendente','vencido','parcialmente_pago') THEN valor_centavos ELSE 0 END),0) pagar,
        COALESCE(SUM(CASE WHEN tipo='receber' AND status IN ('pendente','vencido','parcialmente_pago') THEN valor_centavos ELSE 0 END),0) receber,
        COALESCE(SUM(CASE WHEN status='vencido' THEN valor_centavos ELSE 0 END),0) vencidos
      FROM contas WHERE deleted_at IS NULL AND competencia=@competencia ${companyClause}
    `).get(financeParams)
    const works = this.db.prepare(`
      SELECT COUNT(*) quantidade, COALESCE(SUM(valor_contratado_centavos),0) total
      FROM obras WHERE deleted_at IS NULL AND status NOT IN ('concluida','cancelada')${filters.empresa_id ? ' AND empresa_id=@empresa_id' : ''}
    `).get(companyParams)
    const budget = this.db.prepare(`
      SELECT COALESCE(SUM(i.quantidade*i.valor_unitario_centavos),0) total
      FROM itens_orcamentarios i JOIN obras o ON o.id=i.obra_id
      WHERE i.deleted_at IS NULL${filters.empresa_id ? ' AND o.empresa_id=@empresa_id' : ''}
    `).get(companyParams)
    const trend = this.db.prepare(`
      SELECT competencia,
        SUM(CASE WHEN tipo='receber' AND status!='cancelado' THEN valor_centavos ELSE 0 END) receitas,
        SUM(CASE WHEN tipo='pagar' AND status!='cancelado' THEN valor_centavos ELSE 0 END) despesas
      FROM contas WHERE deleted_at IS NULL AND substr(competencia,1,4)=substr(@competencia,1,4) ${companyClause}
      GROUP BY competencia ORDER BY competencia
    `).all(financeParams)
    const today = new Date(this.now()).toISOString().slice(0, 10)
    const attention = this.db.prepare(`
      SELECT o.id,o.nome,o.status,o.previsao_termino,o.percentual_fisico,o.valor_contratado_centavos,
        COALESCE(SUM(i.quantidade*i.valor_unitario_centavos),0) orcado_centavos
      FROM obras o
      LEFT JOIN itens_orcamentarios i ON i.obra_id=o.id AND i.deleted_at IS NULL
      WHERE o.deleted_at IS NULL AND o.status NOT IN ('concluida','cancelada')${filters.empresa_id ? ' AND o.empresa_id=@empresa_id' : ''}
      GROUP BY o.id
      ORDER BY CASE WHEN o.previsao_termino IS NOT NULL AND o.previsao_termino < date('now') THEN 0 ELSE 1 END, o.previsao_termino ASC
      LIMIT 6
    `).all(companyParams).map(work => {
      const reasons = []
      if (work.previsao_termino && work.previsao_termino < today) reasons.push('prazo vencido')
      if (work.orcado_centavos > work.valor_contratado_centavos && work.valor_contratado_centavos > 0) reasons.push('orcamento acima do contrato')
      if (!reasons.length && Number(work.percentual_fisico) < 100) reasons.push('acompanhar progresso')
      return { ...work, motivo: reasons.join(' | '), nivel: reasons.some(reason => /vencido|acima/.test(reason)) ? 'critico' : 'atencao' }
    })
    const measured = 0
    return {
      ...sums,
      resultado: Number(sums.receitas) - Number(sums.despesas),
      contratos_ativos: works.quantidade,
      total_contratado: works.total,
      total_orcado: Math.round(Number(budget.total || 0)),
      total_medido: measured,
      saldo_medir: Math.max(0, Number(works.total || 0) - measured),
      trend,
      obras_atencao: attention
    }
  }
}
