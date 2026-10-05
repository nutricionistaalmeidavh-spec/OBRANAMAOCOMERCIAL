import { ConcurrencyService } from './concurrency-service.mjs'

export class MeasurementService {
  constructor({ repository }) {
    if (!repository?.connection || !repository?.save) throw new Error('Repositório central inválido para medições.')
    this.repository = repository
    this.db = repository.connection()
    this.concurrency = new ConcurrencyService({ db:this.db })
  }

  save(payload = {}) {
    const { itens = [], conta = null, expectedRevision, revision, requestId = null, ...raw } = payload
    const data = { ...raw }
    const creating = !data.id
    const key = creating ? String(requestId || '').trim() : null
    if (creating && !key) throw new Error('Identificador idempotente da medição não informado.')
    if (creating) {
      const replay = this.db.prepare('SELECT * FROM medicoes WHERE request_id=?').get(key)
      if (replay) return { ...replay, revision:this.concurrency.current('medicoes', replay.id) || this.concurrency.initialize('medicoes', replay.id), itens:this.repository.list('medicao_itens', { medicao_id:replay.id }), replayed:true }
    }
    delete data.conta
    delete data.itens
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (data.id) {
        const current = this.repository.get('medicoes', Number(data.id))
        if (!current) throw new Error('Medição central não encontrada.')
        const observed = this.concurrency.current('medicoes', current.id) || this.concurrency.initialize('medicoes', current.id)
        this.concurrency.assertExpected('medicoes', current.id, expectedRevision ?? revision, { ...current, revision:observed })
      }

      for (const item of itens) {
        const budgetId = Number(item?.item_orcamentario_id)
        if (!Number.isSafeInteger(budgetId) || budgetId < 1) throw new Error('Item orçamentário da medição não informado.')
        const budget = this.repository.get('itens_orcamentarios', budgetId)
        if (!budget || budget.deleted_at) throw new Error('Item orçamentário da medição não encontrado.')
        if (Number(budget.obra_id) !== Number(data.obra_id)) throw new Error('Item orçamentário deve pertencer à mesma obra da medição.')
        const previous = Number(this.db.prepare(`
          SELECT COALESCE(SUM(mi.quantidade_periodo),0) total
          FROM medicao_itens mi
          JOIN medicoes m ON m.id=mi.medicao_id
          WHERE mi.item_orcamentario_id=?
            AND (? IS NULL OR mi.medicao_id!=?)
            AND m.deleted_at IS NULL
            AND m.status!='cancelada'
        `).get(budgetId, data.id || null, data.id || null)?.total || 0)
        const period = Number(item.quantidade_periodo || 0)
        if (!Number.isFinite(period) || period < 0) throw new Error('Quantidade medida inválida.')
        if (previous + period > Number(budget.quantidade || 0) && !String(item.justificativa_excesso || '').trim()) {
          throw new Error(`Medição excede o orçamento do item ${budget.descricao}. Informe uma justificativa.`)
        }
      }

      if (creating) data.request_id = key
      const measurement = this.repository.save('medicoes', data)
      if (!measurement?.id) throw new Error('Medição central não pôde ser salva.')
      if (data.id) this.db.prepare('DELETE FROM medicao_itens WHERE medicao_id=?').run(measurement.id)

      for (const item of itens) {
        const budget = this.repository.get('itens_orcamentarios', Number(item.item_orcamentario_id))
        const previous = Number(this.db.prepare(`
          SELECT COALESCE(SUM(mi.quantidade_periodo),0) total
          FROM medicao_itens mi
          JOIN medicoes m ON m.id=mi.medicao_id
          WHERE mi.item_orcamentario_id=? AND mi.medicao_id!=?
            AND m.deleted_at IS NULL AND m.status!='cancelada'
        `).get(Number(item.item_orcamentario_id), measurement.id)?.total || 0)
        this.repository.save('medicao_itens', {
          medicao_id:measurement.id,
          item_orcamentario_id:Number(item.item_orcamentario_id),
          etapa_id:item.etapa_id || budget?.etapa_id || null,
          descricao:item.descricao || budget?.descricao || 'Item medido',
          unidade:item.unidade || budget?.unidade || 'un',
          quantidade_total:Number(item.quantidade_total || budget?.quantidade || 0),
          quantidade_periodo:Number(item.quantidade_periodo || 0),
          quantidade_acumulada:previous + Number(item.quantidade_periodo || 0),
          valor_periodo_centavos:Number(item.valor_periodo_centavos || 0),
          justificativa_excesso:item.justificativa_excesso || null
        })
      }

      const existingAccount = this.db.prepare("SELECT id FROM contas WHERE origem_tipo='medicao' AND origem_id=? AND deleted_at IS NULL").get(measurement.id)
      const billable = ['faturada','recebida'].includes(String(measurement.status || '')) && conta?.empresa_id && Number(measurement.valor_liquido_centavos || 0) > 0
      if (billable) {
        const accountData = {
          ...conta,
          tipo:'receber',
          obra_id:measurement.obra_id,
          frente_id:measurement.frente_id || null,
          medicao_id:measurement.id,
          descricao:conta.descricao || `Medicao ${measurement.numero}`,
          valor_bruto_centavos:Number(measurement.valor_bruto_centavos || measurement.valor_liquido_centavos || 0),
          retencoes_centavos:Number(measurement.retencoes_centavos || 0),
          descontos_centavos:Number(measurement.descontos_centavos || 0),
          valor_centavos:Number(measurement.valor_liquido_centavos || 0),
          origem_tipo:'medicao',
          origem_id:measurement.id,
          status:measurement.status === 'recebida' ? 'recebido' : 'pendente'
        }
        this.repository.save('contas', existingAccount ? { ...accountData, id:Number(existingAccount.id) } : accountData)
      } else if (existingAccount) {
        this.repository.save('contas', { id:Number(existingAccount.id), status:'cancelado' })
      }

      const currentRevision = data.id
        ? this.concurrency.bump('medicoes', measurement.id)
        : this.concurrency.initialize('medicoes', measurement.id)
      const result = {
        ...this.repository.get('medicoes', measurement.id),
        revision:currentRevision,
        itens:this.repository.list('medicao_itens', { medicao_id:measurement.id })
      }
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      if (creating && /UNIQUE constraint failed: medicoes\.request_id/i.test(String(error?.message || ''))) {
        const existing = this.db.prepare('SELECT * FROM medicoes WHERE request_id=?').get(key)
        if (existing) return { ...existing, revision:this.concurrency.current('medicoes', existing.id) || this.concurrency.initialize('medicoes', existing.id), itens:this.repository.list('medicao_itens', { medicao_id:existing.id }), replayed:true }
      }
      throw error
    }
  }
}
