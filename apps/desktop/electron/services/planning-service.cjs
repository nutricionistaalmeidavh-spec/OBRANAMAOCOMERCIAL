class PlanningService {
  constructor({ db }) { this.db = db }

  overview(obraId) {
    const id = Number(obraId)
    const stages = this.db.db.prepare('SELECT c.*, f.nome frente_nome FROM cronograma_etapas c LEFT JOIN frentes_obra f ON f.id=c.frente_id WHERE c.obra_id=? AND c.deleted_at IS NULL ORDER BY previsto_fim, id').all(id)
    const budget = this.db.db.prepare('SELECT COALESCE(SUM(quantidade*valor_unitario_centavos),0) total FROM itens_orcamentarios WHERE obra_id=? AND deleted_at IS NULL').get(id).total
    const accounts = this.db.db.prepare(`SELECT tipo, competencia, SUM(valor_centavos) valor FROM contas WHERE obra_id=? AND deleted_at IS NULL AND status!='cancelado' GROUP BY tipo, competencia ORDER BY competencia`).all(id)
    let planned = 0, actual = 0
    const curve = stages.map((stage) => {
      planned += Number(stage.custo_planejado_centavos || 0)
      actual += Number(stage.custo_realizado_centavos || 0)
      return { etapa_id: stage.id, nome: stage.nome, data: stage.previsto_fim || stage.previsto_inicio, previsto_centavos: planned, realizado_centavos: actual, percentual_previsto: Number(stage.percentual_previsto), percentual_realizado: Number(stage.percentual_realizado) }
    })
    const cashflow = accounts.reduce((acc, row) => {
      const item = acc.get(row.competencia) || { competencia: row.competencia, receber_centavos: 0, pagar_centavos: 0 }
      item[row.tipo === 'receber' ? 'receber_centavos' : 'pagar_centavos'] += Number(row.valor)
      acc.set(row.competencia, item); return acc
    }, new Map())
    let balance = 0
    const cash = [...cashflow.values()].sort((a,b) => a.competencia.localeCompare(b.competencia)).map((row) => ({ ...row, saldo_periodo_centavos: row.receber_centavos-row.pagar_centavos, saldo_acumulado_centavos: balance += row.receber_centavos-row.pagar_centavos }))
    const fronts = this.db.db.prepare(`
      SELECT f.id,f.nome,
        COALESCE(SUM(i.quantidade*i.valor_unitario_centavos),0) orcado_centavos,
        COALESCE((SELECT SUM(c.valor_centavos) FROM contas c WHERE c.obra_id=f.obra_id AND c.frente_id=f.id AND c.tipo='pagar' AND c.deleted_at IS NULL AND c.status!='cancelado'),0) realizado_centavos
      FROM frentes_obra f LEFT JOIN itens_orcamentarios i ON i.frente_id=f.id AND i.deleted_at IS NULL
      WHERE f.obra_id=? AND f.deleted_at IS NULL GROUP BY f.id ORDER BY f.ordem,f.nome
    `).all(id)
    return { budget_centavos: Number(budget), curve, cash, fronts }
  }
}
module.exports = { PlanningService }
