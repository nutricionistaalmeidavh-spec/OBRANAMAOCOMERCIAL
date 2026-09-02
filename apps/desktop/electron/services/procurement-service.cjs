class ProcurementService {
  constructor({ db }) { this.db = db }

  summary(obraId) {
    const id = Number(obraId)
    const requested = this.db.db.prepare("SELECT COUNT(*) total FROM solicitacoes_compra WHERE obra_id=? AND deleted_at IS NULL AND status NOT IN ('cancelada','concluida')").get(id).total
    const ordered = this.db.db.prepare("SELECT COALESCE(SUM(valor_centavos),0) total FROM pedidos_compra WHERE obra_id=? AND deleted_at IS NULL AND status NOT IN ('cancelado','recebido')").get(id).total
    const received = this.db.db.prepare('SELECT COALESCE(SUM(quantidade_recebida),0) total FROM recebimentos_materiais r JOIN pedidos_compra p ON p.id=r.pedido_compra_id WHERE p.obra_id=? AND p.deleted_at IS NULL').get(id).total
    const stock = this.db.db.prepare(`
      SELECT descricao, unidade,
        SUM(CASE WHEN tipo='entrada' THEN quantidade WHEN tipo='ajuste' THEN quantidade ELSE -quantidade END) saldo
      FROM movimentacoes_estoque WHERE obra_id=? GROUP BY lower(descricao), unidade HAVING saldo > 0 ORDER BY descricao
    `).all(id)
    return { solicitacoes_abertas: Number(requested), comprometido_centavos: Number(ordered), quantidade_recebida: Number(received), estoque: stock }
  }

  createOrder(payload) {
    const { conta = null, itens = [], ...data } = payload
    return this.db.db.transaction(() => {
      const order = this.db.save('pedidos_compra', data)
      for (const item of itens) this.db.save('pedido_compra_itens', { ...item, pedido_compra_id: order.id, quantidade_pedida: Number(item.quantidade_pedida || 0), quantidade_recebida: Number(item.quantidade_recebida || 0), valor_centavos: Number(item.valor_centavos || 0) })
      if (data.solicitacao_id) {
        this.db.save('solicitacoes_compra', { id: data.solicitacao_id, status: 'convertida_pedido', cotacao_escolhida_id: data.cotacao_id || null })
      }
      if (data.cotacao_id) this.db.save('cotacoes_compra', { id: data.cotacao_id, escolhida: 1, status: 'aprovada' })
      let account = null
      if (conta?.empresa_id && Number(data.valor_centavos) > 0) {
        account = this.db.save('contas', { ...conta, tipo: 'pagar', obra_id: data.obra_id, frente_id: data.frente_id || null, etapa_id: data.etapa_id || null, fornecedor_id: data.fornecedor_id || null, pedido_compra_id: order.id, descricao: conta.descricao || `Pedido ${data.numero || order.id}: ${data.descricao}`, valor_bruto_centavos: Number(data.valor_centavos), valor_centavos: Number(data.valor_centavos), origem_tipo: 'pedido_compra', origem_id: order.id, status: conta.status || 'pendente' })
        this.db.save('pedidos_compra', { id: order.id, conta_id: account.id })
      }
      this.db.audit('pedidos_compra', order.id, 'criar_pedido', { obra_id: Number(data.obra_id), frente_id: data.frente_id || null, solicitacao_id: data.solicitacao_id || null, cotacao_id: data.cotacao_id || null, conta_id: account?.id || null, valor_centavos: Number(data.valor_centavos) })
      return { ...order, conta_id: account?.id || null }
    })()
  }

  receiveMaterial(payload) {
    const item = this.db.get('pedido_compra_itens', payload.pedido_item_id)
    if (!item) throw new Error('Item do pedido não encontrado.')
    const order = this.db.get('pedidos_compra', item.pedido_compra_id)
    const quantity = Number(payload.quantidade_recebida)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade recebida válida.')
    if (Number(item.quantidade_recebida) + quantity > Number(item.quantidade_pedida)) throw new Error('O recebimento excede a quantidade pedida.')
    return this.db.db.transaction(() => {
      const receipt = this.db.save('recebimentos_materiais', { pedido_compra_id: order.id, pedido_item_id: item.id, obra_id: order.obra_id, frente_id: order.frente_id || null, data: payload.data, quantidade_pedida: item.quantidade_pedida, quantidade_recebida: quantity, nota_fiscal: payload.nota_fiscal || null, documento_id: payload.documento_id || null, observacoes: payload.observacoes || null })
      this.db.save('pedido_compra_itens', { id: item.id, quantidade_recebida: Number(item.quantidade_recebida) + quantity })
      this.db.save('movimentacoes_estoque', { obra_id: order.obra_id, frente_id: order.frente_id || null, pedido_item_id: item.id, tipo: 'entrada', descricao: item.descricao, unidade: item.unidade, quantidade: quantity, data: payload.data, documento_id: payload.documento_id || null, observacoes: payload.observacoes || null })
      const pendingItems = this.db.db.prepare('SELECT COUNT(*) total FROM pedido_compra_itens WHERE pedido_compra_id=? AND quantidade_recebida < quantidade_pedida').get(order.id).total
      this.db.save('pedidos_compra', { id: order.id, status: pendingItems > 0 ? 'recebido_parcial' : 'recebido' })
      this.db.audit('pedidos_compra', order.id, 'receber_material', { obra_id: order.obra_id, frente_id: order.frente_id || null, pedido_item_id: item.id, quantidade: quantity })
      return receipt
    })()
  }

  moveStock(payload) {
    const quantity = Number(payload.quantidade)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade valida.')
    if (payload.tipo === 'saida') {
      const balance = this.db.db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade WHEN tipo='ajuste' THEN quantidade ELSE -quantidade END),0) total
        FROM movimentacoes_estoque WHERE obra_id=? AND COALESCE(frente_id,0)=COALESCE(?,0) AND lower(descricao)=lower(?) AND unidade=?
      `).get(payload.obra_id, payload.frente_id || null, payload.descricao, payload.unidade || 'un').total
      if (Number(balance) < quantity) throw new Error('A saida deixaria o estoque negativo.')
    }
    const movement = this.db.save('movimentacoes_estoque', { ...payload, quantidade: quantity })
    this.db.audit('movimentacoes_estoque', movement.id, 'movimentar_estoque', { obra_id: payload.obra_id, frente_id: payload.frente_id || null, tipo: payload.tipo, quantidade: quantity })
    return movement
  }
}
module.exports = { ProcurementService }
