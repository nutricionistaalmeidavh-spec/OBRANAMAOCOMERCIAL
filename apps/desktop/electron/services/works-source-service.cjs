function sum(rows, pick) {
  return (rows || []).reduce((total, row) => total + Number(pick(row) || 0), 0)
}

function active(rows) {
  return (rows || []).filter(row => !row?.deleted_at)
}

class WorksSourceService {
  constructor({ local, dataAccess, moduleStorage }) {
    this.local = local
    this.dataAccess = dataAccess
    this.moduleStorage = moduleStorage
  }

  state(moduleName) {
    return this.moduleStorage?.state?.(moduleName)?.state || 'local'
  }

  centralCore() {
    return this.state('core') === 'central-active'
  }

  requiredCentralModules() {
    return ['operation', 'planning', 'finance', 'rh']
  }

  blockedCentralModules() {
    return this.requiredCentralModules().filter(module => this.state(module) !== 'central-active')
  }

  async overview(obraId) {
    if (!this.centralCore()) return this.local.overview(obraId)

    const blocked = this.blockedCentralModules()
    if (blocked.length) {
      throw new Error(`Obra 360 aguarda a centralização dos módulos: ${blocked.join(', ')}.`)
    }

    const [
      obra,
      frentes,
      cronograma,
      rdos,
      tarefas,
      itensOrcamentarios,
      contas,
      funcionarioObras
    ] = await Promise.all([
      this.dataAccess.get('obras', Number(obraId)),
      this.dataAccess.list('frentes_obra', { obra_id: Number(obraId) }),
      this.dataAccess.list('cronograma_etapas', { obra_id: Number(obraId) }),
      this.dataAccess.list('rdos', { obra_id: Number(obraId) }),
      this.dataAccess.list('tarefas_obra', { obra_id: Number(obraId) }),
      this.dataAccess.list('itens_orcamentarios', { obra_id: Number(obraId) }),
      this.dataAccess.list('contas', { obra_id: Number(obraId) }),
      this.dataAccess.list('funcionario_obras', { obra_id: Number(obraId) })
    ])

    if (!obra) throw new Error('Obra não encontrada.')

    const activeAccounts = active(contas).filter(account => account.status !== 'cancelado')
    const pendingTasks = active(tarefas).filter(task => !['concluida', 'cancelada'].includes(String(task.status || '')))
    const budgetByFront = new Map()
    for (const item of active(itensOrcamentarios)) {
      const frontId = Number(item.frente_id || 0)
      budgetByFront.set(frontId, Number(budgetByFront.get(frontId) || 0) + Number(item.quantidade || 0) * Number(item.valor_unitario_centavos || 0))
    }

    const enrichedFronts = active(frentes).map(front => {
      const frontId = Number(front.id)
      const frontAccounts = activeAccounts.filter(account => Number(account.frente_id || 0) === frontId)
      const committed = sum(frontAccounts.filter(account => account.tipo === 'pagar'), account => account.valor_centavos)
      const paid = sum(frontAccounts.filter(account => account.tipo === 'pagar' && ['pago', 'parcialmente_pago'].includes(String(account.status || ''))), account => account.valor_centavos)
      const received = sum(frontAccounts.filter(account => account.tipo === 'receber' && account.status === 'recebido'), account => account.valor_centavos)
      return {
        ...front,
        orcado_centavos: Math.round(Number(budgetByFront.get(frontId) || 0)),
        comprometido_centavos: committed,
        contratado_centavos: 0,
        pago_centavos: paid,
        medido_centavos: 0,
        recebido_centavos: received,
        pendencias_abertas: pendingTasks.filter(task => Number(task.frente_id || 0) === frontId).length
      }
    })

    const despesas = sum(activeAccounts.filter(account => account.tipo === 'pagar'), account => account.valor_centavos)
    const receitas = sum(activeAccounts.filter(account => account.tipo === 'receber'), account => account.valor_centavos)
    const aPagar = sum(activeAccounts.filter(account => account.tipo === 'pagar' && ['pendente', 'vencido', 'parcialmente_pago'].includes(String(account.status || ''))), account => account.valor_centavos)
    const aReceber = sum(activeAccounts.filter(account => account.tipo === 'receber' && ['pendente', 'vencido', 'parcialmente_pago'].includes(String(account.status || ''))), account => account.valor_centavos)
    const employeeIds = new Set(active(funcionarioObras).map(link => Number(link.funcionario_id)).filter(Boolean))

    return {
      obra,
      financeiro: { despesas, receitas, a_pagar: aPagar, a_receber: aReceber },
      orcado_centavos: Math.round(sum(active(itensOrcamentarios), item => Number(item.quantidade || 0) * Number(item.valor_unitario_centavos || 0))),
      medido_centavos: 0,
      cronograma: active(cronograma),
      rdos: active(rdos).slice(0, 5),
      pendencias: pendingTasks.slice(0, 10),
      frentes: enrichedFronts,
      equipe_total: employeeIds.size,
      documentos: [],
      contratos: [],
      compras: [],
      central: true,
      partialCentralOverview: true,
      unavailableSections: ['medições', 'documentos', 'contratos', 'compras']
    }
  }

  async timeline(obraId) {
    if (!this.centralCore()) return this.local.timeline(obraId)
    return []
  }
}

module.exports = { WorksSourceService }
