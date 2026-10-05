export class MeasurementService {
  constructor({ repository }) {
    this.repository = repository
  }

  get db() { return this.repository.connection() }

  saveWithItems(payload = {}) {
    const { itens = [], conta = null, expectedRevision: _expectedRevision, ...data } = payload
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      for (const item of itens) {
        if (!item.item_orcamentario_id) continue
        const budget = this.repository.get('itens_orcamentarios', Number(item.item_orcamentario_id))
        if (!budget) throw new Error('Item orçamentário não encontrado.')
        const previous = this.db.prepare(`SELECT COALESCE(SUM(mi.quantidade_periodo),0) total
          FROM medicao_itens mi JOIN medicoes m ON m.id=mi.medicao_id
          WHERE mi.item_orcamentario_id=? AND (? IS NULL OR mi.medicao_id!=?) AND m.deleted_at IS NULL AND m.status!='cancelada'`)
          .get(Number(item.item_orcamentario_id), data.id || null, data.id || null).total
        if (Number(previous) + Number(item.quantidade_periodo || 0) > Number(budget.quantidade || 0) && !item.justificativa_excesso) {
          throw new Error(`Medição excede o orçamento do item ${budget.descricao}. Informe uma justificativa.`)
        }
      }

      const measurement = this.repository.save('medicoes', data)
      if (!measurement) throw new Error('Medição central não pôde ser salva.')
      if (data.id) this.db.prepare('DELETE FROM medicao_itens WHERE medicao_id=?').run(measurement.id)

      for (const item of itens) {
        const budget = item.item_orcamentario_id ? this.repository.get('itens_orcamentarios', Number(item.item_orcamentario_id)) : null
        const previous = item.item_orcamentario_id
          ? this.db.prepare(`SELECT COALESCE(SUM(mi.quantidade_periodo),0) total
              FROM medicao_itens mi JOIN medicoes m ON m.id=mi.medicao_id
              WHERE mi.item_orcamentario_id=? AND mi.medicao_id!=? AND m.deleted_at IS NULL AND m.status!='cancelada'`)
              .get(Number(item.item_orcamentario_id), measurement.id).total
          : 0
        this.repository.save('medicao_itens', {
          medicao_id: measurement.id,
          item_orcamentario_id: item.item_orcamentario_id,
          etapa_id: item.etapa_id || budget?.etapa_id || null,
          descricao: item.descricao || budget?.descricao || 'Item medido',
          unidade: item.unidade || budget?.unidade || 'un',
          quantidade_total: Number(item.quantidade_total || budget?.quantidade || 0),
          quantidade_periodo: Number(item.quantidade_periodo || 0),
          quantidade_acumulada: Number(previous || 0) + Number(item.quantidade_periodo || 0),
          valor_periodo_centavos: Number(item.valor_periodo_centavos || 0),
          justificativa_excesso: item.justificativa_excesso || null
        })
      }

      if (conta?.empresa_id && Number(data.valor_liquido_centavos || 0) > 0 && ['faturada','recebida'].includes(String(data.status || ''))) {
        const existing = this.db.prepare("SELECT id FROM contas WHERE origem_tipo='medicao' AND origem_id=? AND deleted_at IS NULL").get(measurement.id)
        const account = {
          ...conta,
          tipo: 'receber',
          obra_id: measurement.obra_id,
          frente_id: measurement.frente_id || null,
          medicao_id: measurement.id,
          descricao: conta.descricao || `Medicao ${measurement.numero}`,
          valor_bruto_centavos: Number(data.valor_bruto_centavos || data.valor_liquido_centavos || 0),
          retencoes_centavos: Number(data.retencoes_centavos || 0),
          descontos_centavos: Number(data.descontos_centavos || 0),
          valor_centavos: Number(data.valor_liquido_centavos || 0),
          origem_tipo: 'medicao',
          origem_id: measurement.id,
          status: data.status === 'recebida' ? 'recebido' : 'pendente'
        }
        this.repository.save('contas', existing ? { ...account, id: existing.id } : account)
      }

      this.db.exec('COMMIT;')
      return {
        ...measurement,
        itens: this.repository.list('medicao_itens', { medicao_id: measurement.id })
      }
    } catch (error) {
      try { this.db.exec('ROLLBACK;') } catch {}
      throw error
    }
  }
}
