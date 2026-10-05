function columns(db, table) {
  try { return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => String(row.name))) } catch { return new Set() }
}

function existsTable(db, table) { return columns(db, table).size > 0 }

function activeRow(db, table, id) {
  if (id === null || id === undefined || id === '') return null
  const cols = columns(db, table)
  if (!cols.size) return null
  const deleted = cols.has('deleted_at') ? ' AND deleted_at IS NULL' : ''
  return db.prepare(`SELECT * FROM ${table} WHERE id=?${deleted}`).get(Number(id)) || null
}

function value(data, current, key) { return Object.hasOwn(data || {}, key) ? data[key] : current?.[key] }

function requireRow(db, table, id, label) {
  const row = activeRow(db, table, id)
  if (!row) throw new Error(`${label} não encontrado.`)
  return row
}

function sameWorkFront(db, frontId, workId) {
  if (frontId === null || frontId === undefined || frontId === '') return
  const front = requireRow(db, 'frentes_obra', frontId, 'Frente')
  if (Number(front.obra_id) !== Number(workId)) throw new Error('Frente deve pertencer à mesma obra.')
}

function sameWorkStage(db, stageId, workId) {
  if (stageId === null || stageId === undefined || stageId === '') return
  const stage = requireRow(db, 'etapas_obra', stageId, 'Etapa')
  if (Number(stage.obra_id) !== Number(workId)) throw new Error('Etapa deve pertencer à mesma obra.')
}

function workCompany(db, workId) { return requireRow(db, 'obras', workId, 'Obra').empresa_id }

export function validateCoreOperationOwnership(db, table, data, current = null) {
  const get = key => value(data, current, key)

  if (table === 'clientes') {
    const companyId = get('empresa_id')
    if (companyId !== null && companyId !== undefined && companyId !== '') requireRow(db, 'empresas', companyId, 'Empresa')
    return
  }

  if (table === 'obras') {
    const companyId = get('empresa_id')
    requireRow(db, 'empresas', companyId, 'Empresa')
    const clientId = get('cliente_id')
    if (clientId !== null && clientId !== undefined && clientId !== '') {
      const client = requireRow(db, 'clientes', clientId, 'Cliente')
      if (client.empresa_id !== null && Number(client.empresa_id) !== Number(companyId)) throw new Error('Cliente deve pertencer à mesma empresa.')
    }
    return
  }

  if (table === 'locais_obra') {
    requireRow(db, 'obras', get('obra_id'), 'Obra')
    return
  }

  if (table === 'frentes_obra') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    if (current?.id && Number(current.obra_id) !== Number(workId)) {
      const dependent = [
        ['subfrentes_obra','frente_id'],['checklist_frente_itens','frente_id'],['rdos','frente_id'],['tarefas_obra','frente_id'],
        ['etapas_obra','frente_id'],['cronograma_etapas','frente_id'],['itens_orcamentarios','frente_id'],['medicoes','frente_id'],
        ['solicitacoes_compra','frente_id'],['pedidos_compra','frente_id'],['movimentacoes_estoque','frente_id'],['contratos_obra','frente_id']
      ]
      for (const [child, fk] of dependent) {
        if (!existsTable(db, child)) continue
        const childCols = columns(db, child)
        const deleted = childCols.has('deleted_at') ? ' AND deleted_at IS NULL' : ''
        const hit = db.prepare(`SELECT 1 AS found FROM ${child} WHERE ${fk}=?${deleted} LIMIT 1`).get(Number(current.id))
        if (hit) throw new Error('Frente possui vínculos e não pode ser movida para outra obra.')
      }
    }
    return
  }

  if (table === 'subfrentes_obra') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    if (current?.id && (Number(current.obra_id) !== Number(workId) || Number(current.frente_id) !== Number(get('frente_id')))) {
      const hit = db.prepare('SELECT 1 AS found FROM checklist_frente_itens WHERE subfrente_id=? AND deleted_at IS NULL LIMIT 1').get(Number(current.id))
      if (hit) throw new Error('Subfrente possui checklist e não pode ser movida para outra frente/obra.')
    }
    return
  }

  if (table === 'checklist_frente_itens') {
    const workId = get('obra_id')
    const frontId = get('frente_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, frontId, workId)
    const subId = get('subfrente_id')
    if (subId !== null && subId !== undefined && subId !== '') {
      const sub = requireRow(db, 'subfrentes_obra', subId, 'Subfrente')
      if (Number(sub.obra_id) !== Number(workId) || Number(sub.frente_id) !== Number(frontId)) {
        throw new Error('Subfrente do checklist deve pertencer à mesma frente e obra.')
      }
    }
    return
  }

  if (table === 'rdos') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    return
  }

  if (table === 'tarefas_obra') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    const occurrenceId = get('rdo_ocorrencia_id')
    if (occurrenceId !== null && occurrenceId !== undefined && occurrenceId !== '') {
      const occurrence = requireRow(db, 'rdo_ocorrencias', occurrenceId, 'Ocorrência')
      const report = requireRow(db, 'rdos', occurrence.rdo_id, 'RDO da ocorrência')
      if (Number(report.obra_id) !== Number(workId)) throw new Error('Ocorrência deve pertencer à mesma obra.')
    }
    return
  }

  if (['rdo_equipe','rdo_equipamentos','rdo_ocorrencias','rdo_anexos'].includes(table)) {
    const report = requireRow(db, 'rdos', get('rdo_id'), 'RDO')
    sameWorkFront(db, get('frente_id'), report.obra_id)
    if (table === 'rdo_equipe') {
      const employeeId = get('funcionario_id')
      if (employeeId !== null && employeeId !== undefined && employeeId !== '' && existsTable(db, 'funcionarios')) {
        const employee = requireRow(db, 'funcionarios', employeeId, 'Funcionário')
        const companyId = workCompany(db, report.obra_id)
        if (employee.empresa_id !== null && Number(employee.empresa_id) !== Number(companyId)) throw new Error('Funcionário deve pertencer à mesma empresa da obra.')
      }
    }
    return
  }

  if (table === 'medicoes') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    const contractId = get('contrato_id')
    if (contractId !== null && contractId !== undefined && contractId !== '' && existsTable(db, 'contratos_obra')) {
      const contract = requireRow(db, 'contratos_obra', contractId, 'Contrato')
      if (Number(contract.obra_id) !== Number(workId)) throw new Error('Contrato da medição deve pertencer à mesma obra.')
    }
    return
  }

  if (table === 'medicao_itens') {
    const measurement = requireRow(db, 'medicoes', get('medicao_id'), 'Medição')
    const budget = requireRow(db, 'itens_orcamentarios', get('item_orcamentario_id'), 'Item orçamentário')
    if (Number(budget.obra_id) !== Number(measurement.obra_id)) throw new Error('Item medido deve pertencer à mesma obra da medição.')
    sameWorkStage(db, get('etapa_id'), measurement.obra_id)
    return
  }

  if (table === 'medicao_mapa_itens') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    const measurementId = get('medicao_id')
    if (measurementId !== null && measurementId !== undefined && measurementId !== '') {
      const measurement = requireRow(db, 'medicoes', measurementId, 'Medição')
      if (Number(measurement.obra_id) !== Number(workId)) throw new Error('Medição do mapa deve pertencer à mesma obra.')
    }
    return
  }

  if (table === 'solicitacoes_compra') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    sameWorkStage(db, get('etapa_id'), workId)
    return
  }

  if (table === 'cotacoes_compra') {
    requireRow(db, 'solicitacoes_compra', get('solicitacao_id'), 'Solicitação de compra')
    const supplierId = get('fornecedor_id')
    if (supplierId !== null && supplierId !== undefined && supplierId !== '') requireRow(db, 'fornecedores', supplierId, 'Fornecedor')
    return
  }

  if (table === 'pedidos_compra') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    sameWorkStage(db, get('etapa_id'), workId)
    const requestId = get('solicitacao_id')
    if (requestId !== null && requestId !== undefined && requestId !== '') {
      const request = requireRow(db, 'solicitacoes_compra', requestId, 'Solicitação de compra')
      if (Number(request.obra_id) !== Number(workId)) throw new Error('Solicitação do pedido deve pertencer à mesma obra.')
    }
    const quoteId = get('cotacao_id')
    if (quoteId !== null && quoteId !== undefined && quoteId !== '') {
      const quote = requireRow(db, 'cotacoes_compra', quoteId, 'Cotação')
      if (requestId && Number(quote.solicitacao_id) !== Number(requestId)) throw new Error('Cotação escolhida não pertence à solicitação do pedido.')
    }
    return
  }

  if (table === 'pedido_compra_itens') {
    requireRow(db, 'pedidos_compra', get('pedido_compra_id'), 'Pedido de compra')
    return
  }

  if (table === 'recebimentos_materiais') {
    const order = requireRow(db, 'pedidos_compra', get('pedido_compra_id'), 'Pedido de compra')
    const itemId = get('pedido_item_id')
    if (itemId !== null && itemId !== undefined && itemId !== '') {
      const item = requireRow(db, 'pedido_compra_itens', itemId, 'Item do pedido')
      if (Number(item.pedido_compra_id) !== Number(order.id)) throw new Error('Item recebido não pertence ao pedido informado.')
    }
    if (get('obra_id') !== null && get('obra_id') !== undefined && get('obra_id') !== '' && Number(get('obra_id')) !== Number(order.obra_id)) throw new Error('Recebimento deve pertencer à mesma obra do pedido.')
    return
  }

  if (table === 'movimentacoes_estoque') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    const itemId = get('pedido_item_id')
    if (itemId !== null && itemId !== undefined && itemId !== '') {
      const item = requireRow(db, 'pedido_compra_itens', itemId, 'Item do pedido')
      const order = requireRow(db, 'pedidos_compra', item.pedido_compra_id, 'Pedido de compra')
      if (Number(order.obra_id) !== Number(workId)) throw new Error('Item movimentado deve pertencer à mesma obra.')
    }
    return
  }

  if (table === 'contratos_obra') {
    const workId = get('obra_id')
    const work = requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    const clientId = get('cliente_id')
    if (clientId !== null && clientId !== undefined && clientId !== '') {
      const client = requireRow(db, 'clientes', clientId, 'Cliente')
      if (client.empresa_id !== null && Number(client.empresa_id) !== Number(work.empresa_id)) throw new Error('Cliente do contrato deve pertencer à mesma empresa da obra.')
    }
    const supplierId = get('fornecedor_id')
    if (supplierId !== null && supplierId !== undefined && supplierId !== '') {
      const supplier = requireRow(db, 'fornecedores', supplierId, 'Fornecedor')
      if (supplier.empresa_id !== null && Number(supplier.empresa_id) !== Number(work.empresa_id)) throw new Error('Fornecedor do contrato deve pertencer à mesma empresa da obra.')
    }
    return
  }

  if (table === 'contrato_aditivos') {
    requireRow(db, 'contratos_obra', get('contrato_id'), 'Contrato')
  }
}
