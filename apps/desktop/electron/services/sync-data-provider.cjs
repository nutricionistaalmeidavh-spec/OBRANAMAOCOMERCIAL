const BRIDGE = { frentes_obra: 'fronts', tarefas_obra: 'tasks', rdos: 'rdos', cronograma_etapas: 'schedule' }
const EDITABLE = {
  frentes_obra: ['status', 'observacoes'],
  tarefas_obra: ['status', 'responsavel', 'prazo', 'prioridade', 'descricao', 'observacoes', 'titulo', 'concluido_em'],
  rdos: ['status', 'clima', 'atividades', 'observacoes'],
  cronograma_etapas: ['status', 'percentual_realizado', 'observacoes', 'responsavel', 'previsto_inicio', 'previsto_fim']
}
const WORK_SCOPED = new Set([...Object.keys(BRIDGE), 'documentos'])

const json = JSON.stringify
const payloadOf = row => Object.fromEntries(
  Object.entries({ ...row, deleted: !!row.deleted_at })
    .filter(([key]) => !['created_at', 'updated_at'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
)

class LocalSyncDataProvider {
  constructor({ database, now = Date.now }) {
    this.database = database
    this.now = now
  }

  get db() { return this.database.db }

  accountProvenance(account, scope) {
    const sheet = this.db.prepare('SELECT id,competencia FROM folhas_pagamento WHERE conta_id=? AND empresa_id=? LIMIT 1').get(account.id, account.empresa_id)
    if (sheet) return {
      canonicalEntity: 'conta',
      canonicalId: `local:${scope.deviceId}:${account.id}`,
      originModule: 'rh',
      originEntity: 'folhas_pagamento',
      originId: String(sheet.id),
      originLabel: `Folha ${sheet.competencia || ''}`.trim(),
      originReason: 'Conta vinculada à folha de pagamento'
    }
    const mappings = {
      pedido_compra: ['procurement', 'pedidos_compra', 'Pedido de compra'],
      contrato: ['contracts', 'contratos_obra', 'Contrato'],
      medicao: ['measurements', 'medicoes', 'Medição'],
      importacao_2026: ['finance', 'importacoes', 'Importação financeira'],
      importacao_universal: ['finance', 'importacoes', 'Importação universal']
    }
    const mapped = mappings[String(account.origem_tipo || '')]
    if (mapped && account.origem_id != null) return {
      canonicalEntity: 'conta',
      canonicalId: `local:${scope.deviceId}:${account.id}`,
      originModule: mapped[0],
      originEntity: mapped[1],
      originId: String(account.origem_id),
      originLabel: `${mapped[2]} #${account.origem_id}`,
      originReason: 'Conta gerada por um registro de origem do Obra na Mão'
    }
    return {
      canonicalEntity: 'conta',
      canonicalId: `local:${scope.deviceId}:${account.id}`,
      originModule: 'finance',
      originEntity: 'contas',
      originId: String(account.id),
      originLabel: account.descricao,
      originReason: 'Conta a pagar registrada no Financeiro'
    }
  }

  async resolveScope({ companyId, workId }) {
    const company = this.db.prepare('SELECT * FROM empresas WHERE id=? AND deleted_at IS NULL').get(Number(companyId))
    const work = this.db.prepare('SELECT * FROM obras WHERE id=? AND empresa_id=? AND deleted_at IS NULL').get(Number(workId), Number(companyId))
    if (!company || !work) throw new Error('Selecione uma obra pertencente à empresa local.')
    return {
      companyId: Number(companyId),
      workId: Number(workId),
      companyName: company.razao_social || company.nome_fantasia || String(companyId),
      workName: work.nome
    }
  }

  assertWorkTable(table) {
    if (!WORK_SCOPED.has(table)) throw new Error('Entidade não disponível para sincronização.')
  }

  rowsByWork(table, scope) {
    this.assertWorkTable(table)
    return this.db.prepare(`SELECT * FROM ${table} WHERE obra_id=?`).all(scope.workId)
  }

  listBridge(entity, scope) {
    if (!Object.hasOwn(BRIDGE, entity)) throw new Error('Entidade não disponível na bridge de sincronização.')
    return this.rowsByWork(entity, scope)
  }

  getBridge(entity, localId, scope) {
    if (!Object.hasOwn(BRIDGE, entity)) return null
    return this.db.prepare(`SELECT * FROM ${entity} WHERE id=? AND obra_id=?`).get(Number(localId), scope.workId) || null
  }

  summary(scope, allowed) {
    const rows = table => this.rowsByWork(table, scope).filter(row => !row.deleted_at)
    const accounts = this.db.prepare(`SELECT c.*, COALESCE((SELECT SUM(p.valor_centavos) FROM pagamentos_conta p WHERE p.conta_id=c.id),0) paid_cents FROM contas c WHERE empresa_id=? AND obra_id=? AND deleted_at IS NULL`).all(scope.companyId, scope.workId)
    const today = new Date(this.now()).toISOString().slice(0, 10)
    const stages = rows('cronograma_etapas')
    const rdos = rows('rdos')
    const paid = type => accounts.filter(row => row.tipo === type).reduce((sum, row) => sum + row.paid_cents, 0)
    const open = type => accounts.filter(row => row.tipo === type && !['pago', 'recebido', 'quitado', 'cancelado'].includes(row.status))
    const sum = items => items.reduce((total, row) => total + Math.max(0, row.valor_centavos - row.paid_cents), 0)
    const work = this.db.prepare('SELECT * FROM obras WHERE id=? AND empresa_id=?').get(scope.workId, scope.companyId)
    if (!work || work.deleted_at) throw new Error('Obra local não está disponível para sincronização.')
    const modules = {
      obra360: {
        physicalProgress: work.percentual_fisico,
        activeStages: stages.filter(row => !['concluida', 'concluido', 'cancelada'].includes(row.status)).length,
        overdueStages: stages.filter(row => row.previsto_fim && row.previsto_fim < today && !['concluida', 'concluido', 'cancelada'].includes(row.status)).length
      },
      rdo: {
        total: rdos.length,
        pending: rdos.filter(row => !['fechado', 'finalizado'].includes(row.status)).length,
        finalized: rdos.filter(row => ['fechado', 'finalizado'].includes(row.status)).length
      },
      dre: { revenue: paid('receber'), expense: paid('pagar'), result: paid('receber') - paid('pagar') },
      finance: {
        payableCents: sum(open('pagar')),
        receivableCents: sum(open('receber')),
        overdueCents: sum(open('pagar').filter(row => row.vencimento < today)),
        scope: 'work'
      },
      documents: {
        total: rows('documentos').length,
        expiring30d: rows('documentos').filter(row => row.vencimento && row.vencimento >= today && row.vencimento <= new Date(this.now() + 30 * 86400000).toISOString().slice(0, 10)).length
      }
    }
    return {
      scope: { companyId: scope.remoteCompanyId, projectId: scope.remoteProjectId, workName: scope.workName, period: 'Histórico da obra · caixa' },
      modules: Object.fromEntries(Object.entries(modules).filter(([key]) => allowed.includes(key)))
    }
  }

  obligations(scope) {
    return this.db.prepare("SELECT c.*,f.nome AS beneficiary FROM contas c LEFT JOIN fornecedores f ON f.id=c.fornecedor_id WHERE c.empresa_id=? AND c.obra_id=? AND c.tipo='pagar' ORDER BY c.id")
      .all(scope.companyId, scope.workId)
      .map(account => ({
        sourceId: `${scope.deviceId}:conta:${account.id}`,
        sourceType: 'payable',
        beneficiaryName: account.beneficiary || account.descricao,
        description: account.descricao,
        amountCents: account.valor_centavos,
        dueDate: account.vencimento,
        competence: account.competencia,
        projectId: scope.remoteProjectId,
        status: account.deleted_at ? 'cancelled' : account.status,
        sourceUpdatedAt: account.updated_at || account.created_at,
        ...this.accountProvenance(account, scope)
      }))
  }

  applyRemote(entity, localId, payload, scope) {
    const row = this.getBridge(entity, localId, scope)
    if (!row) return false
    const columns = new Set(this.db.prepare(`PRAGMA table_info(${entity})`).all().map(column => column.name))
    const patch = Object.fromEntries((EDITABLE[entity] || [])
      .filter(key => columns.has(key) && Object.hasOwn(payload, key))
      .map(key => [key, payload[key]]))
    if (payload.deleted) throw new Error('Exclusão remota exige revisão manual no cadastro local.')
    if (Object.keys(patch).length) {
      this.db.prepare(`UPDATE ${entity} SET ${Object.keys(patch).map(key => `${key}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=? AND obra_id=?`)
        .run(...Object.values(patch), Number(localId), scope.workId)
    }
    this.db.prepare('INSERT INTO auditoria(entidade,entidade_id,acao,dados) VALUES(?,?,?,?)')
      .run(entity, Number(localId), 'SYNC_REMOTE_APPLIED', json({ fields: Object.keys(patch) }))
    return true
  }
}

module.exports = { LocalSyncDataProvider, BRIDGE, EDITABLE, payloadOf }
