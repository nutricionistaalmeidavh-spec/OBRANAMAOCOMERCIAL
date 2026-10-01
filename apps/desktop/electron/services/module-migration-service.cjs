const { createHash, randomUUID } = require('node:crypto')

const MODULE_TABLES = Object.freeze({
  core: ['empresas', 'clientes', 'obras'],
  operation: ['frentes_obra', 'rdos', 'rdo_equipe', 'rdo_equipamentos', 'rdo_ocorrencias', 'rdo_anexos', 'tarefas_obra'],
  planning: ['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios'],
  finance: ['fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta'],
  rh: ['cargos', 'beneficios', 'epis', 'funcionarios', 'funcionario_obras', 'cargo_beneficios', 'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'funcionario_epis']
})

const SOURCE_KEY = 'migration_source_fingerprint'
const ATTEMPT_PREFIX = 'module_migration_attempt_'

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

  exportModule(moduleName) {
    const module = this.assertModule(moduleName)
    const records = {}
    const counts = {}
    for (const table of MODULE_TABLES[module]) {
      const rows = [...(this.database.list(table, {}) || [])].sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
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
    const base = {
      module,
      state: state?.state || 'local',
      localCounts: exported.counts,
      capability: false,
      dependencies: { core: coreState || 'local' },
      canMigrate: false
    }

    const storage = this.storage.state()
    const operationalMode = storage.operationalMode || (storage.mode === 'server' ? 'lan-client' : 'local')
    if (!['lan-host', 'lan-client'].includes(operationalMode) || storage.mode !== 'server') return { ...base, reason: 'storage_not_central' }
    if (state?.state !== 'migration-required') return { ...base, reason: 'migration_not_required' }
    if (module !== 'core' && coreState !== 'central-active') return { ...base, reason: 'core_dependency' }

    const capabilities = await this.lanClient.syncSourceCapabilities()
    const supported = Array.isArray(capabilities?.modules) && capabilities.modules.includes(module)
    if (!supported) return { ...base, reason: 'capability_missing' }
    return { ...base, capability: true, canMigrate: true }
  }

  status(moduleName) {
    const module = this.assertModule(moduleName)
    return { module, attempt: this.readAttempt(module), storage: this.moduleStorage.state(module) }
  }

  migrationBlockedMessage(reason) {
    if (reason === 'storage_not_central') return 'Migração central exige servidor LAN configurado.'
    if (reason === 'migration_not_required') return 'Este módulo não está aguardando migração explícita.'
    if (reason === 'core_dependency') return 'Cadastros-base precisam ser migrados antes deste módulo.'
    if (reason === 'capability_missing') return 'O servidor ainda não suporta a migração deste módulo.'
    return 'Migração central não está disponível neste momento.'
  }

  async migrate(moduleName) {
    const module = this.assertModule(moduleName)
    const preflight = await this.preflight(module)
    if (!preflight.canMigrate) throw new Error(this.migrationBlockedMessage(preflight.reason))

    const exported = this.exportModule(module)
    const sourceFingerprint = this.sourceFingerprint()
    const sourceDataHash = digest({ module, records: exported.records })
    let attempt = this.readAttempt(module)

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
      if (remote?.status === 'committed') {
        this.moduleStorage.activateAfterMigration(module)
        this.clearAttempt(module)
        return { migrationId, module, backup, counts: exported.counts, status: 'committed' }
      }
      if (remote?.status === 'validated') {
        await this.lanClient.migrationCommit(migrationId)
        this.moduleStorage.activateAfterMigration(module)
        this.clearAttempt(module)
        return { migrationId, module, backup, counts: exported.counts, status: 'committed' }
      }
      if (remote?.status !== 'started') throw new Error(`Migração remota está em estado incompatível: ${remote?.status || 'desconhecido'}.`)

      for (const table of MODULE_TABLES[module]) {
        for (const row of exported.records[table]) {
          if (row?.id === null || row?.id === undefined) throw new Error(`Registro local sem ID em ${table}.`)
          await this.lanClient.migrationRecord(migrationId, { sourceTable: table, sourceId: row.id, data: row })
        }
      }

      await this.lanClient.migrationValidate(migrationId)
      await this.lanClient.migrationCommit(migrationId)
      this.moduleStorage.activateAfterMigration(module)
      this.clearAttempt(module)
      return { migrationId, module, backup, counts: exported.counts, status: 'committed' }
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
