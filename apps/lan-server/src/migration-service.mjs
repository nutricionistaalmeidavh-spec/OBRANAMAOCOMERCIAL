const MODULE_TABLES = Object.freeze({
  core: ['empresas', 'clientes', 'obras'],
  operation: ['locais_obra', 'frentes_obra', 'subfrentes_obra', 'checklist_frente_itens', 'rdos', 'rdo_equipe', 'rdo_equipamentos', 'rdo_ocorrencias', 'rdo_anexos', 'tarefas_obra'],
  planning: ['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios', 'medicoes', 'medicao_itens', 'medicao_mapa_itens'],
  finance: ['fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta', 'solicitacoes_compra', 'cotacoes_compra', 'pedidos_compra', 'pedido_compra_itens', 'recebimentos_materiais', 'movimentacoes_estoque', 'contratos_obra', 'contrato_aditivos'],
  rh: ['cargos', 'beneficios', 'epis', 'funcionarios', 'funcionario_obras', 'cargo_beneficios', 'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'funcionario_epis', 'cargo_epi_kits'],
  documents: ['fontes_documentais','arquivos','documentos','medicao_anexos','contrato_anexos','pedido_compra_anexos','documentos_editaveis','modelos_documento_rh','empresa_documentos_admissionais']
})

const REF_MAP = Object.freeze({
  clientes: { empresa_id: 'empresas' },
  obras: { empresa_id: 'empresas', cliente_id: 'clientes' },
  locais_obra: { obra_id: 'obras' },
  frentes_obra: { obra_id: 'obras' },
  subfrentes_obra: { obra_id: 'obras', frente_id: 'frentes_obra' },
  checklist_frente_itens: { obra_id: 'obras', frente_id: 'frentes_obra', subfrente_id: 'subfrentes_obra' },
  rdos: { obra_id: 'obras', frente_id: 'frentes_obra' },
  rdo_equipe: { rdo_id: 'rdos', frente_id: 'frentes_obra', funcionario_id: { table: 'funcionarios', deferred: true } },
  rdo_equipamentos: { rdo_id: 'rdos', frente_id: 'frentes_obra' },
  rdo_ocorrencias: { rdo_id: 'rdos', frente_id: 'frentes_obra' },
  rdo_anexos: { rdo_id: 'rdos', frente_id: 'frentes_obra', documento_id: { table: 'documentos', deferred: true } },
  tarefas_obra: { obra_id: 'obras', frente_id: 'frentes_obra', rdo_ocorrencia_id: 'rdo_ocorrencias' },
  etapas_obra: { obra_id: 'obras', frente_id: 'frentes_obra' },
  cronograma_etapas: { obra_id: 'obras', etapa_id: 'etapas_obra', frente_id: 'frentes_obra' },
  itens_orcamentarios: { obra_id: 'obras', etapa_id: 'etapas_obra', frente_id: 'frentes_obra', fonte_documental_id: { table:'fontes_documentais', deferred:true } },
  medicoes: { obra_id: 'obras', frente_id: 'frentes_obra', contrato_id: { table: 'contratos_obra', deferred: true } },
  medicao_itens: { medicao_id: 'medicoes', item_orcamentario_id: 'itens_orcamentarios', etapa_id: 'etapas_obra' },
  medicao_mapa_itens: { obra_id: 'obras', medicao_id: 'medicoes' },
  fornecedores: { empresa_id: 'empresas' },
  contas: { empresa_id: 'empresas', obra_id: 'obras', frente_id: 'frentes_obra', etapa_id: 'etapas_obra', fornecedor_id: 'fornecedores', cliente_id: 'clientes', categoria_id: 'categorias_financeiras', medicao_id: 'medicoes', solicitacao_compra_id: { table: 'solicitacoes_compra', deferred: true }, pedido_compra_id: { table: 'pedidos_compra', deferred: true }, contrato_id: { table: 'contratos_obra', deferred: true } },
  pagamentos_conta: { conta_id: 'contas' },
  solicitacoes_compra: { obra_id: 'obras', frente_id: 'frentes_obra', etapa_id: 'etapas_obra', cotacao_escolhida_id: { table: 'cotacoes_compra', deferred: true } },
  cotacoes_compra: { solicitacao_id: 'solicitacoes_compra', fornecedor_id: 'fornecedores' },
  pedidos_compra: { obra_id: 'obras', frente_id: 'frentes_obra', etapa_id: 'etapas_obra', solicitacao_id: 'solicitacoes_compra', cotacao_id: 'cotacoes_compra', fornecedor_id: 'fornecedores', conta_id: 'contas' },
  pedido_compra_itens: { pedido_compra_id: 'pedidos_compra' },
  recebimentos_materiais: { pedido_compra_id: 'pedidos_compra', pedido_item_id: 'pedido_compra_itens', obra_id: 'obras', frente_id: 'frentes_obra', documento_id: { table: 'documentos', deferred: true } },
  movimentacoes_estoque: { obra_id: 'obras', frente_id: 'frentes_obra', pedido_item_id: 'pedido_compra_itens', documento_id: { table: 'documentos', deferred: true } },
  contratos_obra: { obra_id: 'obras', frente_id: 'frentes_obra', cliente_id: 'clientes', fornecedor_id: 'fornecedores', documento_principal_id: { table: 'documentos', deferred: true }, conta_id: 'contas' },
  contrato_aditivos: { contrato_id: 'contratos_obra', documento_id: { table: 'documentos', deferred: true } },
  cargos: { empresa_id: 'empresas' },
  beneficios: { empresa_id: 'empresas' },
  epis: { empresa_id: 'empresas' },
  funcionarios: { empresa_id: 'empresas', obra_atual_id: 'obras', cargo_id: 'cargos' },
  funcionario_obras: { empresa_id: 'empresas', funcionario_id: 'funcionarios', obra_id: 'obras' },
  cargo_beneficios: { empresa_id: 'empresas', cargo_id: 'cargos', beneficio_id: 'beneficios' },
  funcionario_beneficios: { empresa_id: 'empresas', funcionario_id: 'funcionarios', beneficio_id: 'beneficios' },
  folhas_pagamento: { empresa_id: 'empresas', conta_id: 'contas' },
  folha_lancamentos: { empresa_id: 'empresas', folha_id: 'folhas_pagamento', funcionario_id: 'funcionarios' },
  pagamentos_funcionario: { empresa_id: 'empresas', funcionario_id: 'funcionarios', folha_id: 'folhas_pagamento' },
  pontos_mensais: { empresa_id: 'empresas', funcionario_id: 'funcionarios' },
  ponto_marcacoes: { empresa_id: 'empresas', ponto_mensal_id: 'pontos_mensais' },
  funcionario_epis: { empresa_id: 'empresas', funcionario_id: 'funcionarios', epi_id: 'epis' },
  cargo_epi_kits: { empresa_id:'empresas', cargo_id:'cargos', epi_id:'epis' },
  documentos: {
    arquivo_id:'arquivos', empresa_id:'empresas', obra_id:'obras', frente_id:'frentes_obra', funcionario_id:'funcionarios',
    conta_id:'contas', medicao_id:'medicoes', item_orcamentario_id:'itens_orcamentarios', fornecedor_id:'fornecedores',
    rdo_id:'rdos', contrato_id:'contratos_obra', contrato_aditivo_id:'contrato_aditivos', pedido_compra_id:'pedidos_compra',
    recebimento_material_id:'recebimentos_materiais', documento_origem_id:{table:'documentos',deferred:true}
  },
  medicao_anexos: { medicao_id:'medicoes', documento_id:'documentos' },
  contrato_anexos: { contrato_id:'contratos_obra', documento_id:'documentos' },
  pedido_compra_anexos: { pedido_compra_id:'pedidos_compra', documento_id:'documentos' },
  documentos_editaveis: { documento_id:'documentos' },
  empresa_documentos_admissionais: { empresa_id:'empresas' }
})

const asText = value => String(value)
const canonicalCounts = (module, counts = {}) => Object.fromEntries(MODULE_TABLES[module].map(table => [table, Number(counts?.[table] || 0)]))

export class MigrationService {
  constructor({ repository, security = null, fileStorage = null, now = () => new Date().toISOString() }) {
    if (!repository?.connection || !repository?.save) throw new Error('Repositório LAN inválido para migração.')
    this.repository = repository
    this.security = security
    this.fileStorage = fileStorage
    this.now = now
  }

  get db() { return this.repository.connection() }

  actorFields(actor) {
    return { actorMemberId: actor?.member?.memberId || null, actorDeviceId: actor?.device?.id || null }
  }

  audit(action, migration, actor, details = {}) {
    try {
      this.security?.appendAudit?.({
        ...this.actorFields(actor),
        action,
        targetType: 'module_migration',
        targetId: String(migration?.migration_id || migration?.migrationId || ''),
        details: { module: migration?.module || null, sourceFingerprint: migration?.source_fingerprint || migration?.sourceFingerprint || null, ...details }
      })
    } catch {}
  }

  assertModule(module) {
    const value = String(module || '')
    if (!Object.hasOwn(MODULE_TABLES, value)) throw new Error('Módulo de migração inválido.')
    return value
  }

  row(migrationId) {
    return this.db.prepare('SELECT * FROM module_migrations WHERE migration_id=?').get(asText(migrationId)) || null
  }

  mapMigration(row) {
    if (!row) return null
    return {
      migrationId: row.migration_id,
      module: row.module,
      sourceFingerprint: row.source_fingerprint,
      expectedCounts: JSON.parse(row.expected_counts_json || '{}'),
      status: row.status,
      createdAt: row.created_at,
      validatedAt: row.validated_at || null,
      committedAt: row.committed_at || null,
      rolledBackAt: row.rolled_back_at || null
    }
  }

  start({ migrationId, module, sourceFingerprint, expectedCounts }, actor = null) {
    const id = String(migrationId || '').trim()
    const source = String(sourceFingerprint || '').trim()
    const moduleName = this.assertModule(module)
    if (!id || !source) throw new Error('Identificação/fingerprint da origem da migração não informada.')
    const expected = canonicalCounts(moduleName, expectedCounts)
    const existing = this.row(id)
    if (existing) {
      if (existing.module !== moduleName) throw new Error('MigrationId já pertence a outro módulo.')
      if (existing.source_fingerprint !== source) throw new Error('MigrationId já pertence a outro fingerprint de origem.')
      if (existing.expected_counts_json !== JSON.stringify(expected)) throw new Error('MigrationId já possui outra contagem esperada.')
      return this.status(id)
    }
    this.db.prepare('INSERT INTO module_migrations(migration_id,module,source_fingerprint,expected_counts_json,status,created_at) VALUES(?,?,?,?,?,?)')
      .run(id, moduleName, source, JSON.stringify(expected), 'started', this.now())
    const created = this.row(id)
    this.audit('migration_started', created, actor, { expectedCounts: expected })
    return this.status(id)
  }

  mappingFor(sourceFingerprint, sourceTable, sourceId, currentMigrationId) {
    return this.db.prepare(`SELECT r.target_id FROM module_migration_records r JOIN module_migrations m ON m.migration_id=r.migration_id
      WHERE m.source_fingerprint=? AND r.source_table=? AND r.source_id=? AND (m.status='committed' OR m.migration_id=?)
      ORDER BY CASE WHEN m.migration_id=? THEN 0 ELSE 1 END, m.committed_at DESC LIMIT 1`)
      .get(String(sourceFingerprint), String(sourceTable), asText(sourceId), String(currentMigrationId), String(currentMigrationId)) || null
  }

  remapData(migration, sourceTable, data) {
    const clean = { ...(data || {}) }
    delete clean.id
    for (const [field, rawTarget] of Object.entries(REF_MAP[sourceTable] || {})) {
      const value = clean[field]
      if (value === null || value === undefined || value === '') continue
      const config = typeof rawTarget === 'string' ? { table: rawTarget, deferred: false } : rawTarget
      const mapping = this.mappingFor(migration.source_fingerprint, config.table, value, migration.migration_id)
      if (!mapping) {
        if (config.deferred) { clean[field] = null; continue }
        throw new Error(`Referência ${field} (${config.table}:${value}) ainda não foi migrada.`)
      }
      clean[field] = Number(mapping.target_id)
    }
    return clean
  }

  backfillDeferredReferences(sourceFingerprint, targetSourceTable, targetSourceId, targetId) {
    for (const [sourceTable, fields] of Object.entries(REF_MAP)) {
      for (const [field, rawTarget] of Object.entries(fields || {})) {
        const config = typeof rawTarget === 'string' ? { table: rawTarget, deferred: false } : rawTarget
        if (!config?.deferred || config.table !== targetSourceTable) continue
        if (!MODULE_TABLES[this.rowForSourceTable(sourceTable)?.module]?.includes(sourceTable) && !Object.values(MODULE_TABLES).some(tables => tables.includes(sourceTable))) continue
        const rows = this.db.prepare(`SELECT r.target_id,r.source_data_json FROM module_migration_records r JOIN module_migrations m ON m.migration_id=r.migration_id
          WHERE m.source_fingerprint=? AND m.status='committed' AND r.source_table=?`).all(String(sourceFingerprint), String(sourceTable))
        for (const row of rows) {
          let source
          try { source = JSON.parse(row.source_data_json || '{}') } catch { source = {} }
          if (String(source?.[field] ?? '') !== String(targetSourceId)) continue
          try { this.db.prepare(`UPDATE ${sourceTable} SET ${field}=? WHERE id=?`).run(Number(targetId), Number(row.target_id)) } catch {}
        }
      }
    }
  }

  rowForSourceTable(sourceTable) {
    const module = Object.entries(MODULE_TABLES).find(([, tables]) => tables.includes(sourceTable))?.[0] || null
    return module ? { module } : null
  }

  importRecord(migrationId, { sourceTable, sourceId, data }, _actor = null) {
    const migrationRow = this.row(migrationId)
    if (!migrationRow) throw new Error('Migração não encontrada.')
    if (migrationRow.status !== 'started') throw new Error('Migração não está aberta para importação.')
    const table = String(sourceTable || '')
    if (!MODULE_TABLES[migrationRow.module].includes(table)) throw new Error('Tabela não pertence ao módulo desta migração.')
    if (sourceId === null || sourceId === undefined || sourceId === '') throw new Error('ID de origem não informado.')

    const existing = this.db.prepare('SELECT target_id FROM module_migration_records WHERE migration_id=? AND source_table=? AND source_id=?')
      .get(String(migrationId), table, asText(sourceId))
    if (existing) return { sourceTable: table, sourceId, targetId: Number(existing.target_id), reused: true }

    const remapped = this.remapData(migrationRow, table, data)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const raced = this.db.prepare('SELECT target_id FROM module_migration_records WHERE migration_id=? AND source_table=? AND source_id=?')
        .get(String(migrationId), table, asText(sourceId))
      if (raced) {
        this.db.exec('COMMIT')
        return { sourceTable: table, sourceId, targetId: Number(raced.target_id), reused: true }
      }

      let targetId, createdTarget = 1
      const previous = this.mappingFor(migrationRow.source_fingerprint, table, sourceId, migrationId)
      if (previous) {
        const existingTarget = this.db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(Number(previous.target_id))
        if (existingTarget) { targetId = Number(previous.target_id); createdTarget = 0 }
      }
      if (table === 'categorias_financeiras' && remapped.nome && !targetId) {
        const seeded = this.db.prepare('SELECT id FROM categorias_financeiras WHERE nome=?').get(String(remapped.nome))
        if (seeded) { targetId = Number(seeded.id); createdTarget = 0 }
      }
      if (!targetId) {
        const saved = table === 'arquivos' && data?.__content_base64
          ? this.fileStorage?.storeFileRecord?.(remapped, data.__content_base64)
          : this.repository.save(table, remapped)
        if (table === 'arquivos' && data?.__content_base64 && !this.fileStorage?.storeFileRecord) throw new Error('Storage físico central indisponível para migrar arquivos.')
        if (!saved?.id) throw new Error('Registro central não retornou ID.')
        targetId = Number(saved.id)
      }
      this.db.prepare('INSERT INTO module_migration_records(migration_id,source_table,source_id,target_table,target_id,created_target,source_data_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(String(migrationId), table, asText(sourceId), table, targetId, createdTarget, JSON.stringify(table === 'arquivos' ? { ...(data || {}), __content_base64: undefined } : (data || {})), this.now())
      this.backfillDeferredReferences(migrationRow.source_fingerprint, table, sourceId, targetId)
      this.db.exec('COMMIT')
      return { sourceTable: table, sourceId, targetId, reused: false }
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      throw error
    }
  }

  sanity(migrationId) {
    const row = this.row(migrationId)
    if (!row) throw new Error('Migração não encontrada.')
    const targetCounts = Object.fromEntries(MODULE_TABLES[row.module].map(table => [table, 0]))
    const missingTargets = []
    const records = this.db.prepare('SELECT source_table,source_id,target_table,target_id FROM module_migration_records WHERE migration_id=? ORDER BY source_table,source_id').all(String(migrationId))
    for (const record of records) {
      if (!MODULE_TABLES[row.module].includes(record.target_table)) {
        missingTargets.push({ table:String(record.target_table), targetId:Number(record.target_id), sourceTable:String(record.source_table), sourceId:String(record.source_id) })
        continue
      }
      const exists = this.db.prepare(`SELECT id FROM ${record.target_table} WHERE id=?`).get(Number(record.target_id))
      if (exists) targetCounts[record.source_table] = Number(targetCounts[record.source_table] || 0) + 1
      else missingTargets.push({ table:String(record.target_table), targetId:Number(record.target_id), sourceTable:String(record.source_table), sourceId:String(record.source_id) })
    }
    return { sanityOk: missingTargets.length === 0, targetCounts, missingTargets }
  }

  status(migrationId, _actor = null) {
    const row = this.row(migrationId)
    if (!row) throw new Error('Migração não encontrada.')
    const counts = Object.fromEntries(MODULE_TABLES[row.module].map(table => [table, 0]))
    for (const item of this.db.prepare('SELECT source_table,COUNT(*) AS n FROM module_migration_records WHERE migration_id=? GROUP BY source_table').all(String(migrationId))) {
      counts[item.source_table] = Number(item.n || 0)
    }
    return { ...this.mapMigration(row), counts, ...this.sanity(migrationId) }
  }

  validate(migrationId, actor = null) {
    const current = this.status(migrationId)
    if (current.status === 'validated' || current.status === 'committed') return current
    if (current.status !== 'started') throw new Error('Migração não pode ser validada neste estado.')
    for (const table of MODULE_TABLES[current.module]) {
      if (Number(current.counts[table] || 0) !== Number(current.expectedCounts[table] || 0)) {
        throw new Error(`Contagem migrada divergente em ${table}: esperado ${current.expectedCounts[table] || 0}, recebido ${current.counts[table] || 0}.`)
      }
    }
    if (!current.sanityOk) throw new Error(`Sanidade central falhou: ${current.missingTargets.length} destino(s) de mapping não foram encontrados.`)
    for (const table of MODULE_TABLES[current.module]) {
      if (Number(current.targetCounts[table] || 0) !== Number(current.expectedCounts[table] || 0)) {
        throw new Error(`Sanidade central divergente em ${table}: esperado ${current.expectedCounts[table] || 0}, encontrado ${current.targetCounts[table] || 0}.`)
      }
    }
    this.db.prepare("UPDATE module_migrations SET status='validated',validated_at=? WHERE migration_id=?").run(this.now(), String(migrationId))
    const validated = this.status(migrationId)
    this.audit('migration_validated', validated, actor, { counts: validated.counts })
    return validated
  }

  commit(migrationId, actor = null) {
    const row = this.row(migrationId)
    if (!row) throw new Error('Migração não encontrada.')
    if (row.status === 'committed') return this.status(migrationId)
    if (row.status !== 'validated') throw new Error('Migração precisa estar validada antes do commit.')
    const before = this.status(migrationId)
    if (!before.sanityOk) throw new Error('Migração validada perdeu a sanidade central antes do commit.')
    this.db.prepare("UPDATE module_migrations SET status='committed',committed_at=? WHERE migration_id=?").run(this.now(), String(migrationId))
    const committed = this.status(migrationId)
    this.audit('migration_committed', committed, actor, { counts: committed.counts })
    return committed
  }

  rollback(migrationId, actor = null) {
    const row = this.row(migrationId)
    if (!row) throw new Error('Migração não encontrada.')
    if (row.status === 'rolled_back') return this.status(migrationId)
    if (row.status === 'committed') throw new Error('Migração já commitada não pode ser revertida por este protocolo.')
    const order = new Map(MODULE_TABLES[row.module].map((table, index) => [table, index]))
    const records = this.db.prepare('SELECT source_table,target_table,target_id,created_target FROM module_migration_records WHERE migration_id=?').all(String(migrationId))
      .sort((a, b) => (order.get(b.target_table) ?? -1) - (order.get(a.target_table) ?? -1) || Number(b.target_id) - Number(a.target_id))
    this.db.exec('BEGIN IMMEDIATE')
    try {
      for (const record of records) {
        if (Number(record.created_target) !== 1) continue
        if (!MODULE_TABLES[row.module].includes(record.target_table)) throw new Error('Tabela de rollback inválida.')
        if(record.target_table==='arquivos'&&this.fileStorage?.removeFile){this.fileStorage.removeFile(Number(record.target_id));continue}
        this.db.prepare(`DELETE FROM ${record.target_table} WHERE id=?`).run(Number(record.target_id))
      }
      this.db.prepare("UPDATE module_migrations SET status='rolled_back',rolled_back_at=? WHERE migration_id=?").run(this.now(), String(migrationId))
      this.db.exec('COMMIT')
      const rolledBack = this.status(migrationId)
      this.audit('migration_rollback', rolledBack, actor, { removedCreatedTargets: records.filter(record => Number(record.created_target) === 1).length })
      return rolledBack
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      throw error
    }
  }
}

export { MODULE_TABLES, REF_MAP }