const { planningCurve, planningCash } = require('./domain-core.cjs')

class PlanningService {
  constructor({ db }) { this.db = db }

  overview(obraId) {
    const id = Number(obraId)
    const stages = this.db.db.prepare('SELECT c.*, f.nome frente_nome FROM cronograma_etapas c LEFT JOIN frentes_obra f ON f.id=c.frente_id WHERE c.obra_id=? AND c.deleted_at IS NULL ORDER BY previsto_fim, id').all(id)
    const budget = this.db.db.prepare('SELECT COALESCE(SUM(quantidade*valor_unitario_centavos),0) total FROM itens_orcamentarios WHERE obra_id=? AND deleted_at IS NULL').get(id).total
    const accounts = this.db.db.prepare(`SELECT tipo, competencia, SUM(valor_centavos) valor FROM contas WHERE obra_id=? AND deleted_at IS NULL AND status!='cancelado' GROUP BY tipo, competencia ORDER BY competencia`).all(id)
    const curve = planningCurve(stages)
    const cash = planningCash(accounts)
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
