const MODULES = new Set(['operation', 'planning', 'finance', 'rh'])
const STATES = new Set(['local', 'central-ready', 'central-active', 'migration-required'])
const KEY_PREFIX = 'module_storage_state_'
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
    if (module === 'finance') return this.financeLocalRecordCount()
    if (module === 'rh') return this.rhLocalRecordCount()
    const tables = module === 'operation'
      ? ['frentes_obra', 'tarefas_obra', 'rdos']
      : ['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios']
    return tables.reduce((total, table) => total + this.countActive(table), 0)
  }

  state(moduleName) {
    const module = this.assertModule(moduleName)
    const localRecords = this.localRecordCount(module)
    const financeLocalRecords = module === 'planning' ? this.financeLocalRecordCount() : undefined
    const details = financeLocalRecords === undefined ? { module, localRecords } : { module, localRecords, financeLocalRecords }
    if (this.operationalMode() === 'local') return { ...details, state: 'local' }

    const persisted = this.read(module)
    if (persisted === 'migration-required') return { ...details, state: persisted }

    if (localRecords > 0) {
      this.write(module, 'migration-required')
      return { ...details, state: 'migration-required' }
    }

    if (module === 'planning' && financeLocalRecords > 0) {
      if (persisted !== 'central-ready') this.write(module, 'central-ready')
      return { ...details, state: 'central-ready', financeDependencyBlocked: true }
    }

    if (persisted === 'central-active' || persisted === 'central-ready') return { ...details, state: persisted }
    return { ...details, state: 'central-ready' }
  }

  async refreshCapabilities() {
    const operation = this.state('operation')
    const planning = this.state('planning')
    const finance = this.state('finance')
    const rh = this.state('rh')
    if ([operation.state, planning.state, finance.state, rh.state].every(state => state === 'local' || state === 'migration-required')) {
      return { operation, planning, finance, rh }
    }

    const capabilities = await this.lanClient.syncSourceCapabilities()
    const modules = Array.isArray(capabilities?.modules) ? capabilities.modules : []
    const result = { operation, planning, finance, rh }

    if (!['local', 'migration-required'].includes(operation.state)) {
      const operationAvailable = modules.includes('operation')
      const state = this.write('operation', operationAvailable ? 'central-active' : 'central-ready')
      result.operation = { module: 'operation', state, localRecords: operation.localRecords, capabilityAvailable: operationAvailable }
    }

    if (!['local', 'migration-required'].includes(planning.state)) {
      const planningAvailable = modules.includes('planning')
      const financeDependencyBlocked = Number(planning.financeLocalRecords || 0) > 0
      const state = this.write('planning', planningAvailable && !financeDependencyBlocked ? 'central-active' : 'central-ready')
      result.planning = {
        module: 'planning',
        state,
        localRecords: planning.localRecords,
        financeLocalRecords: planning.financeLocalRecords,
        capabilityAvailable: planningAvailable,
        financeDependencyBlocked
      }
    }

    if (!['local', 'migration-required'].includes(finance.state)) {
      const financeAvailable = modules.includes('finance')
      const state = this.write('finance', financeAvailable ? 'central-active' : 'central-ready')
      result.finance = { module: 'finance', state, localRecords: finance.localRecords, capabilityAvailable: financeAvailable }
    }

    if (!['local', 'migration-required'].includes(rh.state)) {
      const rhAvailable = modules.includes('rh')
      const state = this.write('rh', rhAvailable ? 'central-active' : 'central-ready')
      result.rh = { module: 'rh', state, localRecords: rh.localRecords, capabilityAvailable: rhAvailable }
    }

    return result
  }
}

module.exports = { ModuleStorageStateService }
