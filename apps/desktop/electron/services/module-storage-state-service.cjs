const MODULES = new Set(['core', 'operation', 'planning', 'finance', 'rh'])
const STATES = new Set(['local', 'central-ready', 'central-active', 'migration-required'])
const KEY_PREFIX = 'module_storage_state_'
const MODULE_DEPENDENCIES = Object.freeze({
  core: [],
  operation: ['core'],
  planning: ['core', 'operation'],
  finance: ['core', 'operation', 'planning'],
  rh: ['core', 'operation', 'planning', 'finance']
})
const DEFAULT_FINANCE_CATEGORIES = new Set([
  'Receitas de contratos', 'Medições', 'Folha de pagamento', 'Encargos trabalhistas', 'Benefícios',
  'Materiais', 'Ferramentas', 'Combustível', 'Serviços terceiros', 'Impostos', 'Seguros',
  'Tarifas bancárias', 'Outras despesas'
])

class ModuleStorageStateService {
  constructor({ database, storage, lanClient }) {
    this.database = database
    this.storage = storage
    this.lanClient = lanClient
  }

  assertModule(moduleName) {
    const module = String(moduleName || '').trim()
    if (!MODULES.has(module)) throw new Error('Módulo de armazenamento desconhecido.')
    return module
  }

  read(moduleName) {
    const module = this.assertModule(moduleName)
    const value = this.database.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(`${KEY_PREFIX}${module}`)?.valor
    return STATES.has(value) ? value : null
  }

  write(moduleName, state) {
    const module = this.assertModule(moduleName)
    if (!STATES.has(state) || state === 'local') throw new Error('Estado central de módulo inválido.')
    this.database.db.prepare('INSERT INTO configuracoes(chave,valor,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP')
      .run(`${KEY_PREFIX}${module}`, state)
    return state
  }

  operationalMode() {
    const state = this.storage.state()
    return state.operationalMode || (state.mode === 'server' ? 'lan-client' : 'local')
  }

  tableColumns(table) {
    return new Set(this.database.db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name))
  }

  countActive(table) {
    const columns = this.tableColumns(table)
    if (!columns.size) return 0
    const where = columns.has('deleted_at') ? ' WHERE deleted_at IS NULL' : ''
    const row = this.database.db.prepare(`SELECT COUNT(*) AS n FROM ${table}${where}`).get()
    return Number(row?.n || 0)
  }

  customFinanceCategoryCount() {
    if (!this.tableColumns('categorias_financeiras').size) return 0
    const defaults = [...DEFAULT_FINANCE_CATEGORIES]
    const placeholders = defaults.map(() => '?').join(',')
    const row = this.database.db.prepare(`SELECT COUNT(*) AS n FROM categorias_financeiras WHERE nome NOT IN (${placeholders})`).get(...defaults)
    return Number(row?.n || 0)
  }

  financeLocalRecordCount() {
    return this.countActive('fornecedores') + this.countActive('contas') + this.countActive('pagamentos_conta') + this.customFinanceCategoryCount()
  }

  rhLocalRecordCount() {
    const tables = [
      'funcionarios', 'funcionario_obras', 'cargos', 'beneficios', 'cargo_beneficios', 'funcionario_beneficios',
      'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes',
      'epis', 'funcionario_epis'
    ]
    return tables.reduce((total, table) => total + this.countActive(table), 0)
  }

  localRecordCount(moduleName) {
    const module = this.assertModule(moduleName)
    if (module === 'core') return ['empresas', 'clientes', 'obras'].reduce((total, table) => total + this.countActive(table), 0)
    if (module === 'finance') return this.financeLocalRecordCount()
    if (module === 'rh') return this.rhLocalRecordCount()
    const tables = module === 'operation'
      ? ['frentes_obra', 'tarefas_obra', 'rdos']
      : ['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios']
    return tables.reduce((total, table) => total + this.countActive(table), 0)
  }

  dependencyBlockedBy(moduleName) {
    const module = this.assertModule(moduleName)
    for (const dependency of MODULE_DEPENDENCIES[module]) {
      if (this.state(dependency).state !== 'central-active') return dependency
    }
    return null
  }

  state(moduleName) {
    const module = this.assertModule(moduleName)
    const localRecords = this.localRecordCount(module)
    const details = { module, localRecords }
    if (this.operationalMode() === 'local') return { ...details, state: 'local' }

    const persisted = this.read(module)
    if (persisted === 'migration-required') return { ...details, state: persisted }
    if (localRecords > 0 && persisted !== 'central-active') {
      this.write(module, 'migration-required')
      return { ...details, state: 'migration-required' }
    }

    const dependencyBlockedBy = this.dependencyBlockedBy(module)
    if (dependencyBlockedBy) {
      if (persisted !== 'central-ready') this.write(module, 'central-ready')
      return {
        ...details,
        state: 'central-ready',
        dependencyBlockedBy,
        ...(dependencyBlockedBy === 'core' ? { coreDependencyBlocked: true } : {})
      }
    }

    if (persisted === 'central-active' || persisted === 'central-ready') return { ...details, state: persisted }
    return { ...details, state: 'central-ready' }
  }

  activateAfterMigration(moduleName) {
    const module = this.assertModule(moduleName)
    const current = this.state(module)
    if (!['migration-required', 'central-ready'].includes(current.state)) throw new Error('Módulo não está aguardando ativação central.')
    const dependencyBlockedBy = this.dependencyBlockedBy(module)
    if (dependencyBlockedBy) throw new Error(`O módulo ${dependencyBlockedBy} precisa estar central antes de ${module}.`)
    this.write(module, 'central-active')
    return this.state(module)
  }

  async refreshCapabilities() {
    const initial = Object.fromEntries([...MODULES].map(module => [module, this.state(module)]))
    if (Object.values(initial).every(value => value.state === 'local' || value.state === 'migration-required')) return initial

    const capabilities = await this.lanClient.syncSourceCapabilities()
    const modules = Array.isArray(capabilities?.modules) ? capabilities.modules : []
    const result = { ...initial }

    for (const module of ['core', 'operation', 'planning', 'finance', 'rh']) {
      const current = this.state(module)
      result[module] = current
      if (['local', 'migration-required'].includes(current.state)) continue

      const available = modules.includes(module)
      const dependencyBlockedBy = this.dependencyBlockedBy(module)
      const state = this.write(module, available && !dependencyBlockedBy ? 'central-active' : 'central-ready')
      result[module] = {
        ...current,
        state,
        capabilityAvailable: available,
        ...(dependencyBlockedBy ? { dependencyBlockedBy } : {}),
        ...(dependencyBlockedBy === 'core' ? { coreDependencyBlocked: true } : {})
      }
    }

    return result
  }
}

module.exports = { ModuleStorageStateService, MODULE_DEPENDENCIES }
