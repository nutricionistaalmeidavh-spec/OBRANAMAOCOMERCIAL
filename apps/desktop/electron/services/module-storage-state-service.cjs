const MODULES = new Set(['operation', 'planning'])
const STATES = new Set(['local', 'central-ready', 'central-active', 'migration-required'])
const KEY_PREFIX = 'module_storage_state_'

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

  countActive(table) {
    const row = this.database.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL`).get()
    return Number(row?.n || 0)
  }

  localRecordCount(moduleName) {
    const module = this.assertModule(moduleName)
    const tables = module === 'operation'
      ? ['frentes_obra', 'tarefas_obra', 'rdos']
      : ['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios']
    return tables.reduce((total, table) => total + this.countActive(table), 0)
  }

  financeLocalRecordCount() {
    return this.countActive('contas')
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
    if ([operation.state, planning.state].every(state => state === 'local' || state === 'migration-required')) {
      return { operation, planning }
    }

    const capabilities = await this.lanClient.syncSourceCapabilities()
    const modules = Array.isArray(capabilities?.modules) ? capabilities.modules : []
    const result = { operation, planning }

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

    return result
  }
}

module.exports = { ModuleStorageStateService }
