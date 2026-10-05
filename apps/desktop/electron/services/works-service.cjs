class WorksService {
  constructor({ db, dataAccess = null, moduleStorage = null }) {
    this.db = db
    this.dataAccess = dataAccess
    this.moduleStorage = moduleStorage
  }

  moduleState(module) {
    return this.moduleStorage?.state?.(module)?.state || 'local'
  }

  async overview(obraId) {
    if (!this.dataAccess || this.moduleState('core') !== 'central-active') return this.db.workOverview(obraId)
    return this.centralOverview(Number(obraId))
  }

  async centralOverview(obraId) {
    const obra = await this.dataAccess.get('obras', obraId)
    if (!obra) throw new Error('Obra não encontrada.')

    const operationReady = this.moduleState('operation') === 'central-active'
    const planningReady = this.moduleState('planning') === 'central-active'
    const financeReady = this.moduleState('finance') === 'central-active'
    const rhReady = this.moduleState('rh') === 'central-active'
    const documentsReady = this.moduleState('documents') === 'central-active'

    const [frentesRaw, rdosRaw, tarefasRaw, cronograma, itens, contas, funcionarioObras, medicoes, contratos, compras, documentos] = await Promise.all([
      operationReady ? this.dataAccess.list('frentes_obra', { obra_id: obraId }) : [],
      operationReady ? this.dataAccess.list('rdos', { obra_id: obraId }) : [],
      operationReady ? this.dataAccess.list('tarefas_obra', { obra_id: obraId }) : [],
      planningReady ? this.dataAccess.list('cronograma_etapas', { obra_id: obraId }) : [],
      planningReady ? this.dataAccess.list('itens_orcamentarios', { obra_id: obraId }) : [],
      financeReady ? this.dataAccess.list('contas', { obra_id: obraId }) : [],
      rhReady ? this.dataAccess.list('funcionario_obras', { obra_id: obraId }) : [],
      planningReady ? this.dataAccess.list('medicoes', { obra_id: obraId }) : [],
      financeReady ? this.dataAccess.list('contratos_obra', { obra_id: obraId }) : [],
      financeReady ? this.dataAccess.list('pedidos_compra', { obra_id: obraId }) : [],
      documentsReady ? this.dataAccess.list('documentos', { obra_id: obraId }) : []
    ])

    const activeAccounts = (contas || []).filter(item => item.status !== 'cancelado')
    const financeiro = activeAccounts.reduce((sum, item) => {
      const value = Number(item.valor_centavos || 0)
      if (item.tipo === 'pagar') {
        sum.despesas += value
        if (['pendente', 'vencido', 'parcialmente_pago'].includes(item.status)) sum.a_pagar += value
      } else if (item.tipo === 'receber') {
        sum.receitas += value
        if (['pendente', 'vencido', 'parcialmente_pago'].includes(item.status)) sum.a_receber += value
      }
      return sum
    }, { despesas: 0, receitas: 0, a_pagar: 0, a_receber: 0 })

    const pending = (tarefasRaw || []).filter(item => !['concluida', 'cancelada'].includes(item.status)).slice(0, 10)
    const frontById = new Map((frentesRaw || []).map(item => [Number(item.id), item]))
    const pendencias = pending.map(item => ({ ...item, frente_nome: frontById.get(Number(item.frente_id))?.nome || null }))

    const budgetByFront = new Map()
    let orcado = 0
    for (const item of itens || []) {
      const value = Number(item.quantidade || 0) * Number(item.valor_unitario_centavos || 0)
      orcado += value
      const frontId = Number(item.frente_id || 0)
      if (frontId) budgetByFront.set(frontId, Number(budgetByFront.get(frontId) || 0) + value)
    }

    const accountsByFront = new Map()
    for (const account of activeAccounts) {
      const frontId = Number(account.frente_id || 0)
      if (!frontId) continue
      const current = accountsByFront.get(frontId) || { comprometido: 0, pago: 0 }
      if (account.tipo === 'pagar') {
        current.comprometido += Number(account.valor_centavos || 0)
        if (['pago', 'recebido', 'quitado', 'parcialmente_pago'].includes(account.status)) current.pago += Number(account.valor_centavos || 0)
      }
      accountsByFront.set(frontId, current)
    }

    const contractsByFront = new Map()
    for (const contract of (contratos || []).filter(item => !['cancelado','cancelada'].includes(String(item.status || '')))) {
      const frontId=Number(contract.frente_id || 0)
      if(frontId) contractsByFront.set(frontId,Number(contractsByFront.get(frontId)||0)+Number(contract.valor_centavos||0))
    }

    const measuredByFront = new Map()
    let medido = 0
    for (const measurement of (medicoes || []).filter(item => !['cancelado','cancelada'].includes(String(item.status || '')))) {
      const value=Number(measurement.valor_liquido_centavos ?? measurement.valor_bruto_centavos ?? 0)
      medido += value
      const frontId=Number(measurement.frente_id || 0)
      if(frontId) measuredByFront.set(frontId,Number(measuredByFront.get(frontId)||0)+value)
    }

    const frentes = (frentesRaw || []).map(front => {
      const frontId = Number(front.id)
      const account = accountsByFront.get(frontId) || { comprometido: 0, pago: 0 }
      return {
        ...front,
        orcado_centavos: Number(budgetByFront.get(frontId) || 0),
        comprometido_centavos: account.comprometido,
        contratado_centavos: Number(contractsByFront.get(frontId) || 0),
        pago_centavos: account.pago,
        medido_centavos: Number(measuredByFront.get(frontId) || 0),
        recebido_centavos: 0,
        pendencias_abertas: pending.filter(item => Number(item.frente_id || 0) === frontId).length
      }
    })

    const today = new Date().toISOString().slice(0, 10)
    const activeEmployees = new Set((funcionarioObras || [])
      .filter(item => !item.fim || String(item.fim) >= today)
      .map(item => Number(item.funcionario_id)).filter(Boolean))

    const recency=(a,b)=>String(b.updated_at||b.created_at||b.data||'').localeCompare(String(a.updated_at||a.created_at||a.data||''))
    const complete=operationReady&&planningReady&&financeReady&&rhReady&&documentsReady
    return {
      obra,
      financeiro,
      orcado_centavos: Math.round(orcado),
      medido_centavos: Math.round(medido),
      cronograma: (cronograma || []).slice().sort((a, b) => String(a.previsto_inicio || '').localeCompare(String(b.previsto_inicio || ''))),
      rdos: (rdosRaw || []).slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))).slice(0, 5),
      pendencias,
      frentes,
      equipe_total: activeEmployees.size,
      documentos: (documentos || []).slice().sort(recency).slice(0, 8),
      contratos: (contratos || []).slice().sort(recency).slice(0, 8),
      compras: (compras || []).slice().sort(recency).slice(0, 8),
      serverPartial: !complete,
      availability: {
        core: true,
        operation: operationReady,
        planning: planningReady,
        finance: financeReady,
        rh: rhReady,
        medicoes: planningReady,
        documentos: documentsReady,
        contratos: financeReady,
        compras: financeReady
      }
    }
  }

  timeline(obraId) {
    const rows = this.db.db.prepare(`
      SELECT entidade, entidade_id, acao, dados, created_at
      FROM auditoria
      WHERE (entidade='obras' AND entidade_id=?)
         OR (entidade IN ('contas','medicoes','cronograma_etapas','rdos','solicitacoes_compra','pedidos_compra','contratos_obra')
             AND dados LIKE ?)
      ORDER BY created_at DESC LIMIT 100
    `).all(Number(obraId), `%\"obra_id\":${Number(obraId)}%`)
    return rows.map((row) => ({ ...row, dados: JSON.parse(row.dados || '{}') }))
  }
}
module.exports = { WorksService }
