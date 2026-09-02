class ContractsService {
  constructor({ db, product }) { this.db = db; this.product = product }

  createAddendum(payload) {
    return this.db.db.transaction(() => {
      const addendum = this.db.save('contrato_aditivos', payload)
      if (payload.status === 'contratado') {
        const contract = this.db.get('contratos_obra', payload.contrato_id)
        this.db.save('contratos_obra', { id: contract.id, valor_centavos: Number(contract.valor_centavos) + Number(payload.valor_centavos || 0) })
        if (contract.conta_id) {
          const account = this.db.get('contas', contract.conta_id)
          if (account) this.db.save('contas', { id: account.id, valor_bruto_centavos: Number(account.valor_bruto_centavos || account.valor_centavos) + Number(payload.valor_centavos || 0), valor_centavos: Number(account.valor_centavos) + Number(payload.valor_centavos || 0) })
        }
        this.db.audit('contratos_obra', contract.id, 'aditivo_contratado', { obra_id: contract.obra_id, frente_id: contract.frente_id || null, aditivo_id: addendum.id, valor_centavos: Number(payload.valor_centavos || 0), impacto_prazo_dias: Number(payload.impacto_prazo_dias || 0) })
      }
      return addendum
    })()
  }

  createReceivable(payload) {
    const { conta, ...data } = payload
    return this.db.db.transaction(() => {
      const contract = this.db.save('contratos_obra', data)
      let account = null
      const edition = this.product.getEdition().edition
      if (conta?.empresa_id && Number(data.valor_centavos) > 0 && edition === 'empreiteira') {
        account = this.db.save('contas', { ...conta, tipo: 'receber', obra_id: data.obra_id, frente_id: data.frente_id || null, cliente_id: data.cliente_id || null, contrato_id: contract.id, descricao: conta.descricao || `Contrato ${data.numero || contract.id}: ${data.descricao}`, valor_bruto_centavos: Number(data.valor_centavos), valor_centavos: Number(data.valor_centavos), origem_tipo: 'contrato', origem_id: contract.id, status: conta.status || 'pendente' })
        this.db.save('contratos_obra', { id: contract.id, conta_id: account.id })
      }
      this.db.audit('contratos_obra', contract.id, 'criar_contrato', { obra_id: Number(data.obra_id), frente_id: data.frente_id || null, conta_id: account?.id || null, valor_centavos: Number(data.valor_centavos), retencao_centavos: Number(data.retencao_centavos || 0) })
      return { ...contract, conta_id: account?.id || null }
    })()
  }
}
module.exports = { ContractsService }
