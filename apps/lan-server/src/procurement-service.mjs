export class ProcurementService {
  constructor({ repository }) { this.repository = repository }
  get db() { return this.repository.connection() }

  summary(obraId) {
    const id = Number(obraId)
    const requested = this.db.prepare("SELECT COUNT(*) total FROM solicitacoes_compra WHERE obra_id=? AND deleted_at IS NULL AND status NOT IN ('cancelada','concluida')").get(id).total
    const ordered = this.db.prepare("SELECT COALESCE(SUM(valor_centavos),0) total FROM pedidos_compra WHERE obra_id=? AND deleted_at IS NULL AND status NOT IN ('cancelado','recebido')").get(id).total
    const received = this.db.prepare('SELECT COALESCE(SUM(quantidade_recebida),0) total FROM recebimentos_materiais r JOIN pedidos_compra p ON p.id=r.pedido_compra_id WHERE p.obra_id=? AND p.deleted_at IS NULL').get(id).total
    const stock = this.db.prepare(`
      SELECT descricao, unidade,
        SUM(CASE WHEN tipo='entrada' THEN quantidade WHEN tipo='ajuste' THEN quantidade ELSE -quantidade END) saldo
      FROM movimentacoes_estoque WHERE obra_id=? GROUP BY lower(descricao), unidade HAVING saldo > 0 ORDER BY descricao
    `).all(id)
    return { solicitacoes_abertas:Number(requested), comprometido_centavos:Number(ordered), quantidade_recebida:Number(received), estoque:stock }
  }

  createOrder(payload = {}) {
    const { conta = null, itens = [], ...data } = payload
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const order = this.repository.save('pedidos_compra', data)
      for (const item of itens) this.repository.save('pedido_compra_itens', {
        ...item,
        pedido_compra_id: order.id,
        quantidade_pedida:Number(item.quantidade_pedida || 0),
        quantidade_recebida:Number(item.quantidade_recebida || 0),
        valor_centavos:Number(item.valor_centavos || 0)
      })
      if (data.solicitacao_id) this.repository.save('solicitacoes_compra', { id:data.solicitacao_id, status:'convertida_pedido', cotacao_escolhida_id:data.cotacao_id || null })
      if (data.cotacao_id) this.repository.save('cotacoes_compra', { id:data.cotacao_id, escolhida:1, status:'aprovada' })
      let account = null
      if (conta?.empresa_id && Number(data.valor_centavos || 0) > 0) {
        account = this.repository.save('contas', {
          ...conta, tipo:'pagar', obra_id:data.obra_id, frente_id:data.frente_id || null, etapa_id:data.etapa_id || null,
          fornecedor_id:data.fornecedor_id || null, pedido_compra_id:order.id,
          descricao:conta.descricao || `Pedido ${data.numero || order.id}: ${data.descricao}`,
          valor_bruto_centavos:Number(data.valor_centavos), valor_centavos:Number(data.valor_centavos),
          origem_tipo:'pedido_compra', origem_id:order.id, status:conta.status || 'pendente'
        })
        this.repository.save('pedidos_compra', { id:order.id, conta_id:account.id })
      }
      this.db.exec('COMMIT;')
      return { ...this.repository.get('pedidos_compra', order.id), conta_id:account?.id || order.conta_id || null }
    } catch (error) { try { this.db.exec('ROLLBACK;') } catch {}; throw error }
  }

  receiveMaterial(payload = {}) {
    const item = this.repository.get('pedido_compra_itens', Number(payload.pedido_item_id))
    if (!item) throw new Error('Item do pedido não encontrado.')
    const order = this.repository.get('pedidos_compra', Number(item.pedido_compra_id))
    if (!order) throw new Error('Pedido não encontrado.')
    const quantity = Number(payload.quantidade_recebida)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade recebida válida.')
    if (Number(item.quantidade_recebida || 0) + quantity > Number(item.quantidade_pedida || 0)) throw new Error('O recebimento excede a quantidade pedida.')

    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const receipt = this.repository.save('recebimentos_materiais', {
        pedido_compra_id:order.id, pedido_item_id:item.id, obra_id:order.obra_id, frente_id:order.frente_id || null,
        data:payload.data, quantidade_pedida:item.quantidade_pedida, quantidade_recebida:quantity,
        nota_fiscal:payload.nota_fiscal || null, documento_id:payload.documento_id || null, observacoes:payload.observacoes || null
      })
      this.repository.save('pedido_compra_itens', { id:item.id, quantidade_recebida:Number(item.quantidade_recebida || 0) + quantity })
      this.repository.save('movimentacoes_estoque', {
        obra_id:order.obra_id, frente_id:order.frente_id || null, pedido_item_id:item.id, tipo:'entrada',
        descricao:item.descricao, unidade:item.unidade, quantidade:quantity, data:payload.data,
        documento_id:payload.documento_id || null, observacoes:payload.observacoes || null
      })
      const pending = this.db.prepare('SELECT COUNT(*) total FROM pedido_compra_itens WHERE pedido_compra_id=? AND quantidade_recebida < quantidade_pedida').get(order.id).total
      this.repository.save('pedidos_compra', { id:order.id, status:Number(pending) > 0 ? 'recebido_parcial' : 'recebido' })
      this.db.exec('COMMIT;')
      return receipt
    } catch (error) { try { this.db.exec('ROLLBACK;') } catch {}; throw error }
  }

  moveStock(payload = {}) {
    const quantity = Number(payload.quantidade)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade valida.')
    if (payload.tipo === 'saida') {
      const balance = this.db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade WHEN tipo='ajuste' THEN quantidade ELSE -quantidade END),0) total
        FROM movimentacoes_estoque WHERE obra_id=? AND COALESCE(frente_id,0)=COALESCE(?,0) AND lower(descricao)=lower(?) AND unidade=?
      `).get(payload.obra_id, payload.frente_id || null, payload.descricao, payload.unidade || 'un').total
      if (Number(balance) < quantity) throw new Error('A saida deixaria o estoque negativo.')
    }
    return this.repository.save('movimentacoes_estoque', { ...payload, quantidade:quantity })
  }
}
