const { randomUUID } = require('node:crypto')

const MODULE_TABLES = Object.freeze({
  core: ['empresas', 'clientes', 'obras'],
  operation: ['frentes_obra', 'rdos', 'rdo_equipe', 'rdo_equipamentos', 'rdo_ocorrencias', 'rdo_anexos', 'tarefas_obra'],
  planning: ['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios'],
  finance: ['fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta'],
  rh: ['cargos', 'beneficios', 'epis', 'funcionarios', 'funcionario_obras', 'cargo_beneficios', 'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'funcionario_epis']
})

const SOURCE_KEY = 'migration_source_fingerprint'
const ATTEMPT_PREFIX = 'module_migration_attempt_'

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

  async preflight(moduleName) {
    const module = this.assertModule(moduleName)
    const storage = this.storage.state()
    const operationalMode = storage.operationalMode || (storage.mode === 'server' ? 'lan-client' : 'local')
    if (!['lan-host', 'lan-client'].includes(operationalMode)) throw new Error('Migração central exige servidor LAN configurado.')
    const state = this.moduleStorage.state(module)
    if (state?.state !== 'migration-required') throw new Error('Este módulo não está aguardando migração explícita.')
    if (module !== 'core' && this.moduleStorage.state('core')?.state !== 'central-active') throw new Error('Cadastros-base precisam ser migrados antes deste módulo.')
    const capabilities = await this.lanClient.syncSourceCapabilities()
    const supported = Array.isArray(capabilities?.modules) && capabilities.modules.includes(module)
    if (!supported) throw new Error(`Servidor não anuncia capability para o módulo ${module}.`)
    const exported = this.exportModule(module)
    return { module, state: state.state, localCounts: exported.counts, capability: true, dependencies: { core: module === 'core' || this.moduleStorage.state('core')?.state === 'central-active' }, canMigrate: true }
  }

  status(moduleName) {
    const module = this.assertModule(moduleName)
    return { module, attempt: this.readAttempt(module), storage: this.moduleStorage.state(module) }
  }

  async migrate(moduleName) {
    const module = this.assertModule(moduleName)
    await this.preflight(module)
    const exported = this.exportModule(module)
    const sourceFingerprint = this.sourceFingerprint()
    let attempt = this.readAttempt(module)
    if (attempt && (attempt.sourceFingerprint !== sourceFingerprint || JSON.stringify(attempt.expectedCounts) !== JSON.stringify(exported.counts))) {
      throw new Error('A tentativa de migração pendente não corresponde mais à origem local atual.')
    }
    if (!attempt) {
      attempt = { migrationId: String(this.uuid()), module, sourceFingerprint, expectedCounts: exported.counts }
      this.writeAttempt(module, attempt)
    }

    const backup = await this.backup.createSafetySnapshot({ reason: 'module-migration', module, migrationId: attempt.migrationId, appVersion: this.appVersion })
    let started = false
    try {
      const remote = await this.lanClient.migrationStart(attempt)
      started = true
      if (remote?.status === 'committed') {
        this.moduleStorage.activateAfterMigration(module)
        this.clearAttempt(module)
        return { migrationId: attempt.migrationId, module, backup, counts: exported.counts, status: 'committed' }
      }
      if (remote?.status === 'validated') {
        await this.lanClient.migrationCommit(attempt.migrationId)
        this.moduleStorage.activateAfterMigration(module)
        this.clearAttempt(module)
        return { migrationId: attempt.migrationId, module, backup, counts: exported.counts, status: 'committed' }
      }
      if (remote?.status !== 'started') throw new Error(`Migração remota está em estado incompatível: ${remote?.status || 'desconhecido'}.`)

      for (const table of MODULE_TABLES[module]) {
        for (const row of exported.records[table]) {
          if (row?.id === null || row?.id === undefined) throw new Error(`Registro local sem ID em ${table}.`)
          await this.lanClient.migrationRecord(attempt.migrationId, { sourceTable: table, sourceId: row.id, data: row })
        }
      }
      await this.lanClient.migrationValidate(attempt.migrationId)
      await this.lanClient.migrationCommit(attempt.migrationId)
      this.moduleStorage.activateAfterMigration(module)
      this.clearAttempt(module)
      return { migrationId: attempt.migrationId, module, backup, counts: exported.counts, status: 'committed' }
    } catch (error) {
      if (started) {
        try {
          await this.lanClient.migrationRollback(attempt.migrationId)
          this.clearAttempt(module)
        } catch (rollbackError) {
          if (error && typeof error === 'object') error.rollbackError = rollbackError
        }
      }
      throw error
    }
  }
}

module.exports = { ModuleMigrationService, MODULE_TABLES }
