const MODULES = new Set(['operation'])
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

  localRecordCount(moduleName) {
    const module = this.assertModule(moduleName)
    if (module === 'operation') {
      const tables = ['frentes_obra', 'tarefas_obra', 'rdos']
      return tables.reduce((total, table) => {
        const row = this.database.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL`).get()
        return total + Number(row?.n || 0)
      }, 0)
    }
    return 0
  }

  state(moduleName) {
    const module = this.assertModule(moduleName)
    const localRecords = this.localRecordCount(module)
    if (this.operationalMode() === 'local') return { module, state: 'local', localRecords }

    const persisted = this.read(module)
    if (persisted === 'migration-required') return { module, state: persisted, localRecords }

    if (localRecords > 0) {
      this.write(module, 'migration-required')
      return { module, state: 'migration-required', localRecords }
    }

    if (persisted === 'central-active' || persisted === 'central-ready') return { module, state: persisted, localRecords }
    return { module, state: 'central-ready', localRecords }
  }

  async refreshCapabilities() {
    const current = this.state('operation')
    if (current.state === 'local' || current.state === 'migration-required') return { operation: current }

    const capabilities = await this.lanClient.syncSourceCapabilities()
    const operationAvailable = Array.isArray(capabilities?.modules) && capabilities.modules.includes('operation')
    const state = this.write('operation', operationAvailable ? 'central-active' : 'central-ready')
    return { operation: { module: 'operation', state, localRecords: 0, capabilityAvailable: operationAvailable } }
  }
}

module.exports = { ModuleStorageStateService }
