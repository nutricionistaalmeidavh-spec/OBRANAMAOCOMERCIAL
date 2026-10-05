function idempotencyKey(value) {
  const key = String(value || '').trim()
  if (!key) throw new Error('Identificador idempotente da operação não informado.')
  return key
}

export class ProcurementService {
  constructor({ repository }) {
    if (!repository?.connection || !repository?.save) throw new Error('Repositório central inválido para compras.')
    this.repository = repository
    this.db = repository.connection()
  }

  summary(obraId) {
    const id = Number(obraId)
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Obra inválida para compras.')
    const requested = this.db.prepare("SELECT COUNT(*) total FROM solicitacoes_compra WHERE obra_id=? AND deleted_at IS NULL AND status NOT IN ('cancelada','concluida')").get(id).total
    const ordered = this.db.prepare("SELECT COALESCE(SUM(valor_centavos),0) total FROM pedidos_compra WHERE obra_id=? AND deleted_at IS NULL AND status NOT IN ('cancelado','recebido')").get(id).total
    const received = this.db.prepare('SELECT COALESCE(SUM(quantidade_recebida),0) total FROM recebimentos_materiais r JOIN pedidos_compra p ON p.id=r.pedido_compra_id WHERE p.obra_id=? AND p.deleted_at IS NULL').get(id).total
    const stock = this.db.prepare(`
      SELECT descricao, unidade,
        SUM(CASE WHEN tipo='entrada' THEN quantidade WHEN tipo='ajuste' THEN quantidade ELSE -quantidade END) saldo
      FROM movimentacoes_estoque
      WHERE obra_id=?
      GROUP BY lower(descricao), unidade
      HAVING saldo > 0
      ORDER BY descricao
    `).all(id)
    return {
      solicitacoes_abertas:Number(requested || 0),
      comprometido_centavos:Number(ordered || 0),
      quantidade_recebida:Number(received || 0),
      estoque:stock
    }
  }

  createOrder(payload = {}) {
    const { requestId, conta = null, itens = [], ...data } = payload
    const key = idempotencyKey(requestId)
    const replay = this.db.prepare('SELECT * FROM pedidos_compra WHERE request_id=?').get(key)
    if (replay) return { ...replay, itens:this.repository.list('pedido_compra_itens', { pedido_compra_id:replay.id }), replayed:true }

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const raced = this.db.prepare('SELECT * FROM pedidos_compra WHERE request_id=?').get(key)
      if (raced) {
        this.db.exec('COMMIT')
        return { ...raced, itens:this.repository.list('pedido_compra_itens', { pedido_compra_id:raced.id }), replayed:true }
      }
      const order = this.repository.save('pedidos_compra', { ...data, request_id:key })
      if (!order?.id) throw new Error('Pedido central não pôde ser criado.')

      for (const item of itens) {
        const quantity = Number(item.quantidade_pedida || 0)
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantidade pedida inválida.')
        this.repository.save('pedido_compra_itens', {
          ...item,
          pedido_compra_id:order.id,
          quantidade_pedida:quantity,
          quantidade_recebida:Number(item.quantidade_recebida || 0),
          valor_centavos:Number(item.valor_centavos || 0)
        })
      }

      if (data.solicitacao_id) {
        this.repository.save('solicitacoes_compra', {
          id:Number(data.solicitacao_id),
          status:'convertida_pedido',
          cotacao_escolhida_id:data.cotacao_id || null
        })
      }
      if (data.cotacao_id) this.repository.save('cotacoes_compra', { id:Number(data.cotacao_id), escolhida:1, status:'aprovada' })

      let account = null
      if (conta?.empresa_id && Number(data.valor_centavos || 0) > 0) {
        account = this.repository.save('contas', {
          ...conta,
          tipo:'pagar',
          obra_id:data.obra_id,
          frente_id:data.frente_id || null,
          etapa_id:data.etapa_id || null,
          fornecedor_id:data.fornecedor_id || null,
          pedido_compra_id:order.id,
          descricao:conta.descricao || `Pedido ${data.numero || order.id}: ${data.descricao}`,
          valor_bruto_centavos:Number(data.valor_centavos),
          valor_centavos:Number(data.valor_centavos),
          origem_tipo:'pedido_compra',
          origem_id:order.id,
          status:conta.status || 'pendente'
        })
        this.repository.save('pedidos_compra', { id:order.id, conta_id:account.id })
      }

      const result = {
        ...this.repository.get('pedidos_compra', order.id),
        conta_id:account?.id || order.conta_id || null,
        itens:this.repository.list('pedido_compra_itens', { pedido_compra_id:order.id })
      }
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      if (/UNIQUE constraint failed: pedidos_compra\.request_id/i.test(String(error?.message || ''))) {
        const existing = this.db.prepare('SELECT * FROM pedidos_compra WHERE request_id=?').get(key)
        if (existing) return { ...existing, itens:this.repository.list('pedido_compra_itens', { pedido_compra_id:existing.id }), replayed:true }
      }
      throw error
    }
  }

  receiveMaterial(payload = {}) {
    const key = idempotencyKey(payload.requestId)
    const replay = this.db.prepare('SELECT * FROM recebimentos_materiais WHERE request_id=?').get(key)
    if (replay) return { ...replay, replayed:true }

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const item = this.repository.get('pedido_compra_itens', Number(payload.pedido_item_id))
      if (!item) throw new Error('Item do pedido não encontrado.')
      const order = this.repository.get('pedidos_compra', Number(item.pedido_compra_id))
      if (!order || order.deleted_at) throw new Error('Pedido não encontrado.')
      const quantity = Number(payload.quantidade_recebida)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade recebida válida.')
      if (Number(item.quantidade_recebida || 0) + quantity > Number(item.quantidade_pedida || 0)) throw new Error('O recebimento excede a quantidade pedida.')

      const receipt = this.repository.save('recebimentos_materiais', {
        pedido_compra_id:order.id,
        pedido_item_id:item.id,
        obra_id:order.obra_id,
        frente_id:order.frente_id || null,
        documento_id:payload.documento_id || null,
        data:payload.data,
        quantidade_pedida:item.quantidade_pedida,
        quantidade_recebida:quantity,
        nota_fiscal:payload.nota_fiscal || null,
        observacoes:payload.observacoes || null,
        request_id:key
      })
      this.repository.save('pedido_compra_itens', {
        id:item.id,
        quantidade_recebida:Number(item.quantidade_recebida || 0) + quantity
      })
      this.repository.save('movimentacoes_estoque', {
        obra_id:order.obra_id,
        frente_id:order.frente_id || null,
        pedido_item_id:item.id,
        documento_id:payload.documento_id || null,
        tipo:'entrada',
        descricao:item.descricao,
        unidade:item.unidade,
        quantidade:quantity,
        data:payload.data,
        observacoes:payload.observacoes || null,
        request_id:`receipt:${key}`
      })
      const pending = Number(this.db.prepare('SELECT COUNT(*) total FROM pedido_compra_itens WHERE pedido_compra_id=? AND quantidade_recebida < quantidade_pedida').get(order.id)?.total || 0)
      this.repository.save('pedidos_compra', { id:order.id, status:pending > 0 ? 'recebido_parcial' : 'recebido' })
      this.db.exec('COMMIT')
      return receipt
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      if (/UNIQUE constraint failed: recebimentos_materiais\.request_id/i.test(String(error?.message || ''))) {
        const existing = this.db.prepare('SELECT * FROM recebimentos_materiais WHERE request_id=?').get(key)
        if (existing) return { ...existing, replayed:true }
      }
      throw error
    }
  }

  moveStock(payload = {}) {
    const key = idempotencyKey(payload.requestId)
    const replay = this.db.prepare('SELECT * FROM movimentacoes_estoque WHERE request_id=?').get(key)
    if (replay) return { ...replay, replayed:true }

    const quantity = Number(payload.quantidade)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade válida.')
    if (!['entrada','saida','ajuste'].includes(String(payload.tipo || ''))) throw new Error('Tipo de movimentação de estoque inválido.')

    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (payload.tipo === 'saida') {
        const balance = Number(this.db.prepare(`
          SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade WHEN tipo='ajuste' THEN quantidade ELSE -quantidade END),0) total
          FROM movimentacoes_estoque
          WHERE obra_id=? AND COALESCE(frente_id,0)=COALESCE(?,0)
            AND lower(descricao)=lower(?) AND unidade=?
        `).get(payload.obra_id, payload.frente_id || null, payload.descricao, payload.unidade || 'un')?.total || 0)
        if (balance < quantity) throw new Error('A saída deixaria o estoque negativo.')
      }
      const movement = this.repository.save('movimentacoes_estoque', { ...payload, quantidade:quantity, request_id:key })
      this.db.exec('COMMIT')
      return movement
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      if (/UNIQUE constraint failed: movimentacoes_estoque\.request_id/i.test(String(error?.message || ''))) {
        const existing = this.db.prepare('SELECT * FROM movimentacoes_estoque WHERE request_id=?').get(key)
        if (existing) return { ...existing, replayed:true }
      }
      throw error
    }
  }
}
