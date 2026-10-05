export class ContractsService {
  constructor({ repository }) { this.repository = repository }
  get db() { return this.repository.connection() }

  createReceivable(payload = {}) {
    const { conta = null, edition = 'construtora', ...data } = payload
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const contract = this.repository.save('contratos_obra', data)
      let account = null
      if (conta?.empresa_id && Number(data.valor_centavos || 0) > 0 && edition === 'empreiteira') {
        account = this.repository.save('contas', {
          ...conta, tipo:'receber', obra_id:data.obra_id, frente_id:data.frente_id || null,
          cliente_id:data.cliente_id || null, contrato_id:contract.id,
          descricao:conta.descricao || `Contrato ${data.numero || contract.id}: ${data.descricao}`,
          valor_bruto_centavos:Number(data.valor_centavos), valor_centavos:Number(data.valor_centavos),
          origem_tipo:'contrato', origem_id:contract.id, status:conta.status || 'pendente'
        })
        this.repository.save('contratos_obra', { id:contract.id, conta_id:account.id })
      }
      this.db.exec('COMMIT;')
      return { ...this.repository.get('contratos_obra', contract.id), conta_id:account?.id || contract.conta_id || null }
    } catch (error) { try { this.db.exec('ROLLBACK;') } catch {}; throw error }
  }

  createAddendum(payload = {}) {
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const addendum = this.repository.save('contrato_aditivos', payload)
      if (payload.status === 'contratado') {
        const contract = this.repository.get('contratos_obra', Number(payload.contrato_id))
        if (!contract) throw new Error('Contrato não encontrado.')
        this.repository.save('contratos_obra', { id:contract.id, valor_centavos:Number(contract.valor_centavos || 0) + Number(payload.valor_centavos || 0) })
        if (contract.conta_id) {
          const account = this.repository.get('contas', Number(contract.conta_id))
          if (account) this.repository.save('contas', {
            id:account.id,
            valor_bruto_centavos:Number(account.valor_bruto_centavos || account.valor_centavos || 0) + Number(payload.valor_centavos || 0),
            valor_centavos:Number(account.valor_centavos || 0) + Number(payload.valor_centavos || 0)
          })
        }
      }
      this.db.exec('COMMIT;')
      return addendum
    } catch (error) { try { this.db.exec('ROLLBACK;') } catch {}; throw error }
  }
}
