import domainCore from './domain-core.cjs'
const { planningCurve } = domainCore
export class PlanningService {
  constructor({ repository }) {
    if (!repository?.connection || !repository?.get) throw new Error('Repositório LAN inválido para Planejamento.')
    this.repository = repository
    this.db = repository.connection()
  }

  overview(obraId) {
    const id = Number(obraId)
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Obra inválida para Planejamento.')
    const work = this.repository.get('obras', id)
    if (!work || work.deleted_at) throw new Error('Obra não encontrada para Planejamento.')

    const stages = this.db.prepare(`
      SELECT c.*, f.nome frente_nome
      FROM cronograma_etapas c
      LEFT JOIN frentes_obra f ON f.id=c.frente_id AND f.deleted_at IS NULL
      WHERE c.obra_id=? AND c.deleted_at IS NULL
      ORDER BY c.previsto_fim, c.id
    `).all(id)

    const budget = this.db.prepare(`
      SELECT COALESCE(SUM(quantidade*valor_unitario_centavos),0) total
      FROM itens_orcamentarios
      WHERE obra_id=? AND deleted_at IS NULL
    `).get(id).total

    const curve = planningCurve(stages)

    const fronts = this.db.prepare(`
      SELECT f.id,f.nome,
        COALESCE(SUM(i.quantidade*i.valor_unitario_centavos),0) orcado_centavos
      FROM frentes_obra f
      LEFT JOIN itens_orcamentarios i ON i.frente_id=f.id AND i.obra_id=f.obra_id AND i.deleted_at IS NULL
      WHERE f.obra_id=? AND f.deleted_at IS NULL
      GROUP BY f.id
      ORDER BY f.ordem,f.nome
    `).all(id).map(front => ({
      id: front.id,
      nome: front.nome,
      orcado_centavos: Number(front.orcado_centavos || 0),
      realizado_centavos: 0
    }))

    return {
      budget_centavos: Number(budget || 0),
      curve,
      cash: [],
      fronts
    }
  }
}
