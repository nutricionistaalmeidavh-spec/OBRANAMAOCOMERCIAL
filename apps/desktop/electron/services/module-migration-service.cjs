const { createHash, randomUUID } = require('node:crypto')

const MODULE_TABLES = Object.freeze({
  core: ['empresas', 'clientes', 'obras'],
  operation: ['locais_obra', 'frentes_obra', 'subfrentes_obra', 'checklist_frente_itens', 'rdos', 'rdo_equipe', 'rdo_equipamentos', 'rdo_ocorrencias', 'tarefas_obra'],
  planning: ['fontes_documentais', 'etapas_obra', 'cronograma_etapas', 'itens_orcamentarios', 'medicoes', 'medicao_itens', 'medicao_mapa_itens'],
  finance: ['fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta', 'solicitacoes_compra', 'cotacoes_compra', 'pedidos_compra', 'pedido_compra_itens', 'recebimentos_materiais', 'movimentacoes_estoque', 'contratos_obra', 'contrato_aditivos'],
  rh: ['cargos', 'beneficios', 'epis', 'funcionarios', 'funcionario_obras', 'cargo_beneficios', 'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'funcionario_epis', 'arquivos', 'documentos', 'rdo_anexos', 'medicao_anexos', 'contrato_anexos', 'pedido_compra_anexos', 'documentos_editaveis', 'modelos_documento_rh']
})

const SOURCE_KEY = 'migration_source_fingerprint'
const ATTEMPT_PREFIX = 'module_migration_attempt_'
const MIGRATION_FORMAT_VERSION = 2

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

class ModuleMigrationService {
  constructor({ database, storage, moduleStorage, lanClient, backup, appVersion = '', uuid = randomUUID, sourceId = randomUUID }) {
    this.database = database
    this.storage = storage
    this.moduleStorage = moduleStorage
    this.lanClient = lanClient
    this.backup = backup
    this.appVersion = appVersion
    this.uuid = uuid
    this.sourceId = sourceId
  }

  assertModule(moduleName) {
    const module = String(moduleName || '').trim()
    if (!Object.hasOwn(MODULE_TABLES, module)) throw new Error('Módulo de migração desconhecido.')
    return module
  }

  configGet(key) {
    return this.database.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(String(key))?.valor || null
  }

  configSet(key, value) {
    this.database.db.prepare('INSERT INTO configuracoes(chave,valor,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP').run(String(key), String(value))
  }

  configDelete(key) {
    this.database.db.prepare('DELETE FROM configuracoes WHERE chave=?').run(String(key))
  }

  sourceFingerprint() {
    const existing = this.configGet(SOURCE_KEY)
    if (existing) return String(existing)
    const created = String(this.sourceId())
    this.configSet(SOURCE_KEY, created)
    return created
  }

  attemptKey(moduleName) { return `${ATTEMPT_PREFIX}${this.assertModule(moduleName)}` }

  readAttempt(moduleName) {
    const raw = this.configGet(this.attemptKey(moduleName))
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }

  writeAttempt(moduleName, attempt) { this.configSet(this.attemptKey(moduleName), JSON.stringify(attempt)) }
  clearAttempt(moduleName) { this.configDelete(this.attemptKey(moduleName)) }

  singleLocalCompanyId() {
    const columns = this.database.db.prepare('PRAGMA table_info(empresas)').all().map(column => String(column.name))
    const where = columns.includes('deleted_at') ? ' WHERE deleted_at IS NULL' : ''
    const rows = this.database.db.prepare(`SELECT id FROM empresas${where} ORDER BY id`).all()
    return rows.length === 1 ? Number(rows[0].id) : null
  }

  distinctCompanyIds(sql, ...params) {
    return [...new Set(this.database.db.prepare(sql).all(...params)
      .map(row => Number(row.empresa_id))
      .filter(value => Number.isSafeInteger(value) && value > 0))]
  }

  resolveLegacyRhCompanyId(table, row) {
    const direct = Number(row?.empresa_id)
    if (Number.isSafeInteger(direct) && direct > 0) return direct

    let candidates = []
    if (table === 'cargos') {
      candidates = this.distinctCompanyIds('SELECT empresa_id FROM funcionarios WHERE cargo_id=? AND empresa_id IS NOT NULL', Number(row.id))
    } else if (table === 'beneficios') {
      candidates = this.distinctCompanyIds(`
        SELECT f.empresa_id FROM funcionario_beneficios fb JOIN funcionarios f ON f.id=fb.funcionario_id
        WHERE fb.beneficio_id=? AND f.empresa_id IS NOT NULL
        UNION
        SELECT f.empresa_id FROM cargo_beneficios cb JOIN funcionarios f ON f.cargo_id=cb.cargo_id
        WHERE cb.beneficio_id=? AND f.empresa_id IS NOT NULL
      `, Number(row.id), Number(row.id))
    } else if (table === 'epis') {
      candidates = this.distinctCompanyIds('SELECT f.empresa_id FROM funcionario_epis fe JOIN funcionarios f ON f.id=fe.funcionario_id WHERE fe.epi_id=? AND f.empresa_id IS NOT NULL', Number(row.id))
    } else if (table === 'funcionario_obras' || table === 'funcionario_beneficios' || table === 'pagamentos_funcionario' || table === 'pontos_mensais' || table === 'funcionario_epis') {
      candidates = this.distinctCompanyIds('SELECT empresa_id FROM funcionarios WHERE id=? AND empresa_id IS NOT NULL', Number(row.funcionario_id))
    } else if (table === 'cargo_beneficios') {
      candidates = this.distinctCompanyIds('SELECT empresa_id FROM funcionarios WHERE cargo_id=? AND empresa_id IS NOT NULL', Number(row.cargo_id))
    } else if (table === 'folha_lancamentos') {
      candidates = this.distinctCompanyIds('SELECT empresa_id FROM folhas_pagamento WHERE id=? AND empresa_id IS NOT NULL', Number(row.folha_id))
      if (!candidates.length) candidates = this.distinctCompanyIds('SELECT empresa_id FROM funcionarios WHERE id=? AND empresa_id IS NOT NULL', Number(row.funcionario_id))
    } else if (table === 'ponto_marcacoes') {
      candidates = this.distinctCompanyIds(`
        SELECT f.empresa_id FROM pontos_mensais p JOIN funcionarios f ON f.id=p.funcionario_id
        WHERE p.id=? AND f.empresa_id IS NOT NULL
      `, Number(row.ponto_mensal_id))
    }

    if (candidates.length === 1) return candidates[0]
    const single = this.singleLocalCompanyId()
    if (single) return single
    const suffix = candidates.length > 1 ? 'há vínculos com mais de uma empresa' : 'há mais de uma empresa local e o registro não possui vínculo suficiente'
    throw new Error(`Não foi possível determinar a empresa de ${table} #${row?.id ?? '?' }: ${suffix}.`)
  }

  normalizeExportRow(module, table, row) {
    if (module !== 'rh') return { ...row }
    const rhTables = new Set([
      'cargos','beneficios','epis','funcionarios','funcionario_obras','cargo_beneficios',
      'funcionario_beneficios','folhas_pagamento','folha_lancamentos','pagamentos_funcionario',
      'pontos_mensais','ponto_marcacoes','funcionario_epis'
    ])
    if (!rhTables.has(table)) return { ...row }
    return { ...row, empresa_id: this.resolveLegacyRhCompanyId(table, row) }
  }

  exportModule(moduleName) {
    const module = this.assertModule(moduleName)
    const records = {}
    const counts = {}
    for (const table of MODULE_TABLES[module]) {
      const rows = [...(this.database.list(table, {}) || [])]
        .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
        .map(row => this.normalizeExportRow(module, table, row))
      records[table] = rows
      counts[table] = rows.length
    }
    return { records, counts }
  }

  sourceDataHash(moduleName) {
    const module = this.assertModule(moduleName)
    const exported = this.exportModule(module)
    return digest({ module, records: exported.records })
  }

  async preflight(moduleName) {
    const module = this.assertModule(moduleName)
    const exported = this.exportModule(module)
    const state = this.moduleStorage.state(module)
    const coreState = module === 'core' ? state?.state : this.moduleStorage.state('core')?.state
    const dependencyBlockedBy = module === 'core' ? null : (this.moduleStorage.dependencyBlockedBy?.(module) || (coreState !== 'central-active' ? 'core' : null))
    const base = {
      module,
      state: state?.state || 'local',
      localCounts: exported.counts,
      capability: false,
      dependencies: { core: coreState || 'local', blockedBy: dependencyBlockedBy },
      canMigrate: false
    }

    const storage = this.storage.state()
    const operationalMode = storage.operationalMode || (storage.mode === 'server' ? 'lan-client' : 'local')
    if (!['lan-host', 'lan-client', 'remote'].includes(operationalMode) || storage.mode !== 'server') return { ...base, reason: 'storage_not_central' }
    if (state?.state !== 'migration-required') return { ...base, reason: 'migration_not_required' }
    if (dependencyBlockedBy) return { ...base, reason: dependencyBlockedBy === 'core' ? 'core_dependency' : 'module_dependency' }

    const capabilities = await this.lanClient.syncSourceCapabilities()
    const supported = Array.isArray(capabilities?.modules) && capabilities.modules.includes(module)
    if (!supported) return { ...base, reason: 'capability_missing' }
    return { ...base, capability: true, canMigrate: true }
  }

  status(moduleName) {
    const module = this.assertModule(moduleName)
    return { module, attempt: this.readAttempt(module), storage: this.moduleStorage.state(module) }
  }

  migrationBlockedMessage(reason, preflight = null) {
    if (reason === 'storage_not_central') return 'Migração central exige um servidor Obra na Mão configurado.'
    if (reason === 'migration_not_required') return 'Este módulo não está aguardando migração explícita.'
    if (reason === 'core_dependency') return 'Cadastros-base precisam ser migrados antes deste módulo.'
    if (reason === 'module_dependency') return `O módulo ${preflight?.dependencies?.blockedBy || 'anterior'} precisa estar central antes desta migração.`
    if (reason === 'capability_missing') return 'O servidor ainda não suporta a migração deste módulo.'
    return 'Migração central não está disponível neste momento.'
  }

  assertCommittedSanity(remoteStatus, expectedCounts) {
    if (remoteStatus?.status !== 'committed') throw new Error(`Migração central ainda não está commitada: ${remoteStatus?.status || 'estado desconhecido'}.`)
    if (remoteStatus?.sanityOk !== true) throw new Error('Sanidade central não foi confirmada após o commit; o módulo continuará em migration-required.')
    if (Array.isArray(remoteStatus?.missingTargets) && remoteStatus.missingTargets.length) throw new Error('Sanidade central encontrou mappings sem registro de destino.')
    for (const [table, expected] of Object.entries(expectedCounts || {})) {
      if (Number(remoteStatus?.counts?.[table] ?? -1) !== Number(expected)) throw new Error(`Contagem remota pós-commit divergente em ${table}.`)
      if (Number(remoteStatus?.targetCounts?.[table] ?? -1) !== Number(expected)) throw new Error(`Sanidade de destinos pós-commit divergente em ${table}.`)
    }
    return remoteStatus
  }

  async confirmCommitted(migrationId, expectedCounts) {
    const remoteStatus = await this.lanClient.migrationStatus(migrationId)
    return this.assertCommittedSanity(remoteStatus, expectedCounts)
  }

  async activateCommitted(module, migrationId, expectedCounts, backup) {
    const confirmed = await this.confirmCommitted(migrationId, expectedCounts)
    this.moduleStorage.activateAfterMigration(module)
    this.clearAttempt(module)
    return { migrationId, module, backup, counts: expectedCounts, status: 'committed', sanityOk: true, centralStatus: confirmed }
  }

  async resetLegacyAttempt(module, attempt) {
    if (!attempt?.migrationId || Number(attempt.formatVersion || 0) >= MIGRATION_FORMAT_VERSION) return attempt
    const remote = await this.lanClient.migrationStatus(attempt.migrationId)
    if (['started','validated'].includes(String(remote?.status || ''))) {
      await this.lanClient.migrationRollback(attempt.migrationId)
    } else if (!['committed','rolled_back'].includes(String(remote?.status || ''))) {
      throw new Error('A tentativa anterior usa um formato antigo e não pôde ser reconciliada com segurança.')
    }
    this.clearAttempt(module)
    return null
  }

  async migrate(moduleName) {
    const module = this.assertModule(moduleName)
    const preflight = await this.preflight(module)
    if (!preflight.canMigrate) throw new Error(this.migrationBlockedMessage(preflight.reason, preflight))

    const exported = this.exportModule(module)
    const sourceFingerprint = this.sourceFingerprint()
    const sourceDataHash = digest({ module, records: exported.records })
    let attempt = this.readAttempt(module)
    attempt = await this.resetLegacyAttempt(module, attempt)

    if (attempt) {
      const sameSource = attempt.sourceFingerprint === sourceFingerprint
      const sameCounts = JSON.stringify(attempt.expectedCounts) === JSON.stringify(exported.counts)
      const sameData = attempt.sourceDataHash === sourceDataHash
      if (!sameSource || !sameCounts || !sameData) {
        throw new Error('Os dados locais deste módulo mudaram desde a tentativa pendente. Faça rollback explícito da tentativa antes de iniciar uma nova migração.')
      }
    }

    const migrationId = attempt?.migrationId || String(this.uuid())
    const backup = await this.backup.createSafetySnapshot({ reason: 'module-migration', module, migrationId, appVersion: this.appVersion })

    if (!attempt) {
      attempt = {
        migrationId,
        module,
        formatVersion:MIGRATION_FORMAT_VERSION,
        sourceFingerprint,
        sourceDataHash,
        expectedCounts: exported.counts,
        backupFingerprint: backup.fingerprint || null,
        backupDatabase: backup.database || null,
        backupManifest: backup.manifest || null,
        status: 'backed-up',
        createdAt: new Date().toISOString()
      }
    } else {
      attempt = {
        ...attempt,
        latestBackupFingerprint: backup.fingerprint || null,
        latestBackupDatabase: backup.database || null,
        latestBackupManifest: backup.manifest || null,
        updatedAt: new Date().toISOString()
      }
    }
    this.writeAttempt(module, attempt)

    try {
      const remote = await this.lanClient.migrationStart({ migrationId, module, sourceFingerprint, expectedCounts: exported.counts })
      attempt = { ...attempt, status: remote?.status || 'started', updatedAt: new Date().toISOString(), lastError: null }
      this.writeAttempt(module, attempt)

      if (remote?.status === 'rolled_back') {
        this.clearAttempt(module)
        throw new Error('A tentativa remota já foi revertida. Inicie a migração novamente.')
      }
      if (remote?.status === 'committed') return await this.activateCommitted(module, migrationId, exported.counts, backup)
      if (remote?.status === 'validated') {
        await this.lanClient.migrationCommit(migrationId)
        return await this.activateCommitted(module, migrationId, exported.counts, backup)
      }
      if (remote?.status !== 'started') throw new Error(`Migração remota está em estado incompatível: ${remote?.status || 'desconhecido'}.`)

      for (const table of MODULE_TABLES[module]) {
        for (const row of exported.records[table]) {
          if (row?.id === null || row?.id === undefined) throw new Error(`Registro local sem ID em ${table}.`)
          if (table === 'arquivos') {
            if (!this.lanClient.migrationFile) throw new Error('Servidor/cliente não suporta migração de arquivos compartilhados.')
            await this.lanClient.migrationFile(migrationId, row.id, row)
          } else {
            await this.lanClient.migrationRecord(migrationId, { sourceTable: table, sourceId: row.id, data: row })
          }
        }
      }

      await this.lanClient.migrationValidate(migrationId)
      await this.lanClient.migrationCommit(migrationId)
      return await this.activateCommitted(module, migrationId, exported.counts, backup)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (this.readAttempt(module)) this.writeAttempt(module, { ...attempt, status: 'failed', lastError: message, updatedAt: new Date().toISOString() })
      throw error
    }
  }

  async rollback(moduleName) {
    const module = this.assertModule(moduleName)
    const attempt = this.readAttempt(module)
    if (!attempt?.migrationId) return { module, status: 'no_pending_attempt' }
    const result = await this.lanClient.migrationRollback(attempt.migrationId)
    if (result?.status === 'rolled_back') this.clearAttempt(module)
    return { module, ...result }
  }
}

module.exports = { ModuleMigrationService, MODULE_TABLES }
