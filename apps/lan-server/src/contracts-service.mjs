import { ConcurrencyService } from './concurrency-service.mjs'

function keyOf(value) {
  const key = String(value || '').trim()
  if (!key) throw new Error('Identificador idempotente da operação não informado.')
  return key
}

export class ContractsService {
  constructor({ repository }) {
    if (!repository?.connection || !repository?.save) throw new Error('Repositório central inválido para contratos.')
    this.repository = repository
    this.db = repository.connection()
    this.concurrency = new ConcurrencyService({ db:this.db })
  }

  saveContract(payload = {}) {
    const { conta = null, edition = 'construtora', requestId = null, expectedRevision, revision, ...data } = payload
    const editing = Number.isSafeInteger(Number(data.id)) && Number(data.id) > 0
    const key = editing ? null : keyOf(requestId)

    if (!editing) {
      const replay = this.db.prepare('SELECT * FROM contratos_obra WHERE request_id=?').get(key)
      if (replay) return { ...replay, revision:this.concurrency.current('contratos_obra', replay.id) || this.concurrency.initialize('contratos_obra', replay.id), replayed:true }
    }

    this.db.exec('BEGIN IMMEDIATE')
    try {
      let current = null
      if (editing) {
        current = this.repository.get('contratos_obra', Number(data.id))
        if (!current || current.deleted_at) throw new Error('Contrato central não encontrado.')
        const observed = this.concurrency.current('contratos_obra', current.id) || this.concurrency.initialize('contratos_obra', current.id)
        this.concurrency.assertExpected('contratos_obra', current.id, expectedRevision ?? revision, { ...current, revision:observed })
      } else {
        const raced = this.db.prepare('SELECT * FROM contratos_obra WHERE request_id=?').get(key)
        if (raced) {
          this.db.exec('COMMIT')
          return { ...raced, revision:this.concurrency.current('contratos_obra', raced.id) || this.concurrency.initialize('contratos_obra', raced.id), replayed:true }
        }
      }

      const contract = this.repository.save('contratos_obra', { ...data, ...(editing ? {} : { request_id:key }) })
      if (!contract?.id) throw new Error('Contrato central não pôde ser salvo.')

      const existingAccount = this.db.prepare("SELECT id FROM contas WHERE origem_tipo='contrato' AND origem_id=? AND deleted_at IS NULL").get(contract.id)
      const receivable = edition === 'empreiteira' && conta?.empresa_id && Number(contract.valor_centavos || 0) > 0
      if (receivable) {
        const accountData = {
          ...conta,
          tipo:'receber',
          obra_id:contract.obra_id,
          frente_id:contract.frente_id || null,
          cliente_id:contract.cliente_id || null,
          contrato_id:contract.id,
          descricao:conta.descricao || `Contrato ${contract.numero || contract.id}: ${contract.descricao}`,
          valor_bruto_centavos:Number(contract.valor_centavos || 0),
          valor_centavos:Number(contract.valor_centavos || 0),
          origem_tipo:'contrato',
          origem_id:contract.id,
          status:conta.status || 'pendente'
        }
        const account = this.repository.save('contas', existingAccount ? { ...accountData, id:Number(existingAccount.id) } : accountData)
        this.repository.save('contratos_obra', { id:contract.id, conta_id:account.id })
      } else if (existingAccount && edition === 'empreiteira') {
        this.repository.save('contas', { id:Number(existingAccount.id), status:'cancelado' })
      }

      const nextRevision = editing
        ? this.concurrency.bump('contratos_obra', contract.id)
        : this.concurrency.initialize('contratos_obra', contract.id)
      const result = { ...this.repository.get('contratos_obra', contract.id), revision:nextRevision }
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      if (!editing && /UNIQUE constraint failed: contratos_obra\.request_id/i.test(String(error?.message || ''))) {
        const existing = this.db.prepare('SELECT * FROM contratos_obra WHERE request_id=?').get(key)
        if (existing) return { ...existing, revision:this.concurrency.current('contratos_obra', existing.id) || this.concurrency.initialize('contratos_obra', existing.id), replayed:true }
      }
      throw error
    }
  }

  addendum(payload = {}) {
    const { requestId, ...data } = payload
    const key = keyOf(requestId)
    const replay = this.db.prepare('SELECT * FROM contrato_aditivos WHERE request_id=?').get(key)
    if (replay) return { ...replay, replayed:true }

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const contract = this.repository.get('contratos_obra', Number(data.contrato_id))
      if (!contract || contract.deleted_at) throw new Error('Contrato não encontrado.')
      const raced = this.db.prepare('SELECT * FROM contrato_aditivos WHERE request_id=?').get(key)
      if (raced) {
        this.db.exec('COMMIT')
        return { ...raced, replayed:true }
      }

      const contracted = String(data.status || '') === 'contratado'
      const addendum = this.repository.save('contrato_aditivos', {
        ...data,
        request_id:key,
        applied_at:contracted ? new Date().toISOString() : null
      })
      if (contracted) {
        const delta = Number(data.valor_centavos || 0)
        const updated = this.repository.save('contratos_obra', {
          id:contract.id,
          valor_centavos:Number(contract.valor_centavos || 0) + delta
        })
        if (contract.conta_id) {
          const account = this.repository.get('contas', Number(contract.conta_id))
          if (account) {
            this.repository.save('contas', {
              id:account.id,
              valor_bruto_centavos:Number(account.valor_bruto_centavos || account.valor_centavos || 0) + delta,
              valor_centavos:Number(account.valor_centavos || 0) + delta
            })
          }
        }
        if (updated) {
          if (!this.concurrency.current('contratos_obra', contract.id)) this.concurrency.initialize('contratos_obra', contract.id)
          this.concurrency.bump('contratos_obra', contract.id)
        }
      }
      this.db.exec('COMMIT')
      return addendum
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      if (/UNIQUE constraint failed: contrato_aditivos\.request_id/i.test(String(error?.message || ''))) {
        const existing = this.db.prepare('SELECT * FROM contrato_aditivos WHERE request_id=?').get(key)
        if (existing) return { ...existing, replayed:true }
      }
      throw error
    }
  }
}
