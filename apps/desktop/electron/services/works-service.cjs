class WorksService {
  constructor({ db }) { this.db = db }

  overview(obraId) { return this.db.workOverview(obraId) }

  timeline(obraId) {
    const rows = this.db.db.prepare(`
      SELECT entidade, entidade_id, acao, dados, created_at
      FROM auditoria
      WHERE (entidade='obras' AND entidade_id=?)
         OR (entidade IN ('contas','medicoes','cronograma_etapas','rdos','solicitacoes_compra','pedidos_compra','contratos_obra')
             AND dados LIKE ?)
      ORDER BY created_at DESC LIMIT 100
    `).all(Number(obraId), `%\"obra_id\":${Number(obraId)}%`)
    return rows.map((row) => ({ ...row, dados: JSON.parse(row.dados || '{}') }))
  }
}
module.exports = { WorksService }
