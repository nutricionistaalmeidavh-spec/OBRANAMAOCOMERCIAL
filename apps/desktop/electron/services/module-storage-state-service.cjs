const MODULES = new Set(['core', 'operation', 'planning', 'finance', 'rh', 'documents'])
const STATES = new Set(['local', 'central-ready', 'central-active', 'migration-required'])
const KEY_PREFIX = 'module_storage_state_'
const VERSION_KEY_PREFIX = 'module_storage_contract_version_'
const MODULE_CONTRACT_VERSIONS = Object.freeze({ core:2, operation:2, planning:2, finance:2, rh:2, documents:1 })
const MODULE_DEPENDENCIES = Object.freeze({
  core: [],
  operation: ['core'],
  planning: ['core', 'operation'],
  finance: ['core', 'operation', 'planning'],
  rh: ['core', 'operation', 'planning', 'finance'],
  documents: ['core', 'operation', 'planning', 'finance', 'rh']
})
const DEFAULT_FINANCE_CATEGORIES = new Set([
  'Receitas de contratos', 'Medições', 'Folha de pagamento', 'Encargos trabalhistas', 'Benefícios',
  'Materiais', 'Ferramentas', 'Combustível', 'Serviços terceiros', 'Impostos', 'Seguros',
  'Tarifas bancárias', 'Outras despesas'
])
const DEFAULT_RH_CARGOS = new Map([
  ['Encanador', '724110'],
  ['Ajudante de Encanador', '724110']
])
const DEFAULT_RH_BENEFITS = new Map([
  ['Vale-transporte', 'transporte'],
  ['Vale-alimentação', 'alimentacao'],
  ['Café', 'alimentacao'],
  ['Prêmio', 'premio']
])
const DEFAULT_RH_EPIS = new Map([
  ['Uniforme', '-'], ['Botina', '12160'], ['Capacete com jugular', '36099'], ['Protetor auditivo', '5745'],
  ['Protetor solar', '-'], ['Touca árabe', '-'], ['Luva multitato', '30916'], ['Óculos de proteção', '9722'],
  ['Máscara PFF2', '10578'], ['Cinto de segurança com talabarte e trava-quedas', '41046']
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

  readVersion(moduleName) {
    const module = this.assertModule(moduleName)
    const raw = this.database.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(`${VERSION_KEY_PREFIX}${module}`)?.valor
    const value = Number(raw)
    return Number.isInteger(value) && value > 0 ? value : null
  }

  writeVersion(moduleName, version) {
    const module = this.assertModule(moduleName)
    const value = Number(version)
    if (!Number.isInteger(value) || value < 1) throw new Error('Versão de contrato de módulo inválida.')
    this.database.db.prepare('INSERT INTO configuracoes(chave,valor,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP')
      .run(`${VERSION_KEY_PREFIX}${module}`, String(value))
    return value
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
    const tables = [
      'fornecedores','contas','pagamentos_conta','solicitacoes_compra','cotacoes_compra','pedidos_compra',
      'pedido_compra_itens','recebimentos_materiais','movimentacoes_estoque','contratos_obra','contrato_aditivos'
    ]
    return tables.reduce((total, table) => total + this.countActive(table), 0) + this.customFinanceCategoryCount()
  }

  customRhCargoCount() {
    if (!this.tableColumns('cargos').size) return 0
    const rows = this.database.db.prepare('SELECT nome,cbo,salario_base_centavos,ativo FROM cargos').all()
    return rows.filter(row => {
      const expectedCbo = DEFAULT_RH_CARGOS.get(String(row.nome || ''))
      return expectedCbo === undefined || String(row.cbo || '') !== expectedCbo || Number(row.salario_base_centavos || 0) !== 0 || Number(row.ativo) !== 1
    }).length
  }

  customRhBenefitCount() {
    if (!this.tableColumns('beneficios').size) return 0
    const rows = this.database.db.prepare('SELECT nome,tipo,valor_padrao_centavos,ativo FROM beneficios').all()
    return rows.filter(row => {
      const expectedType = DEFAULT_RH_BENEFITS.get(String(row.nome || ''))
      return expectedType === undefined || String(row.tipo || '') !== expectedType || Number(row.valor_padrao_centavos || 0) !== 0 || Number(row.ativo) !== 1
    }).length
  }

  customRhEpiCount() {
    if (!this.tableColumns('epis').size) return 0
    const rows = this.database.db.prepare('SELECT nome,ca,unidade,ativo FROM epis').all()
    return rows.filter(row => {
      const expectedCa = DEFAULT_RH_EPIS.get(String(row.nome || ''))
      return expectedCa === undefined || String(row.ca || '') !== expectedCa || String(row.unidade || 'un') !== 'un' || Number(row.ativo) !== 1
    }).length
  }

  customRhCargoBenefitCount() {
    if (!this.tableColumns('cargo_beneficios').size) return 0
    const rows = this.database.db.prepare(`
      SELECT c.nome AS cargo_nome,b.nome AS beneficio_nome,cb.valor_centavos,cb.quinzena,cb.natureza,cb.ativo
      FROM cargo_beneficios cb
      JOIN cargos c ON c.id=cb.cargo_id
      JOIN beneficios b ON b.id=cb.beneficio_id
    `).all()
    return rows.filter(row => {
      const defaultLink = DEFAULT_RH_CARGOS.has(String(row.cargo_nome || '')) && ['Vale-alimentação', 'Café'].includes(String(row.beneficio_nome || ''))
      return !defaultLink || Number(row.valor_centavos || 0) !== 0 || Number(row.quinzena) !== 1 || String(row.natureza || '') !== 'credito' || Number(row.ativo) !== 1
    }).length
  }

  rhLocalRecordCount() {
    const operationalTables = [
      'funcionarios', 'funcionario_obras', 'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos',
      'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'funcionario_epis', 'cargo_epi_kits'
    ]
    const operational = operationalTables.reduce((total, table) => total + this.countActive(table), 0)
    return operational + this.customRhCargoCount() + this.customRhBenefitCount() + this.customRhCargoBenefitCount() + this.customRhEpiCount()
  }

  localRecordCount(moduleName) {
    const module = this.assertModule(moduleName)
    if (module === 'core') return ['empresas', 'clientes', 'obras'].reduce((total, table) => total + this.countActive(table), 0)
    if (module === 'finance') return this.financeLocalRecordCount()
    if (module === 'rh') return this.rhLocalRecordCount()
    if (module === 'documents') {
      const tables=['fontes_documentais','arquivos','documentos','medicao_anexos','contrato_anexos','pedido_compra_anexos','documentos_editaveis','modelos_documento_rh','empresa_documentos_admissionais']
      return tables.reduce((total,table)=>total+this.countActive(table),0)
    }
    const tables = module === 'operation'
      ? ['locais_obra','frentes_obra','subfrentes_obra','checklist_frente_itens','tarefas_obra','rdos','rdo_equipe','rdo_equipamentos','rdo_ocorrencias','rdo_anexos']
      : ['etapas_obra','cronograma_etapas','itens_orcamentarios','medicoes','medicao_itens','medicao_mapa_itens']
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
    const requiredVersion = Number(MODULE_CONTRACT_VERSIONS[module] || 1)
    const recordedVersion = this.readVersion(module) || (persisted === 'central-active' ? 1 : 0)
    if (persisted === 'migration-required') return { ...details, state: persisted, contractVersion: recordedVersion, requiredContractVersion: requiredVersion }
    if (persisted === 'central-active' && recordedVersion < requiredVersion) {
      this.write(module, 'migration-required')
      return { ...details, state: 'migration-required', contractVersion: recordedVersion, requiredContractVersion: requiredVersion, contractUpgradeRequired: true }
    }
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

  activateAfterMigration(moduleName, contractVersion = MODULE_CONTRACT_VERSIONS[String(moduleName)] || 1) {
    const module = this.assertModule(moduleName)
    const current = this.state(module)
    if (!['migration-required', 'central-ready'].includes(current.state)) throw new Error('Módulo não está aguardando ativação central.')
    const dependencyBlockedBy = this.dependencyBlockedBy(module)
    if (dependencyBlockedBy) throw new Error(`O módulo ${dependencyBlockedBy} precisa estar central antes de ${module}.`)
    this.writeVersion(module, contractVersion)
    this.write(module, 'central-active')
    return this.state(module)
  }

  async refreshCapabilities() {
    const initial = Object.fromEntries([...MODULES].map(module => [module, this.state(module)]))
    if (Object.values(initial).every(value => value.state === 'local' || value.state === 'migration-required')) return initial

    const capabilities = await this.lanClient.syncSourceCapabilities()
    const modules = Array.isArray(capabilities?.modules) ? capabilities.modules : []
    const result = { ...initial }

    for (const module of ['core', 'operation', 'planning', 'finance', 'rh', 'documents']) {
      const current = this.state(module)
      result[module] = current
      if (['local', 'migration-required'].includes(current.state)) continue

      const available = modules.includes(module)
      const dependencyBlockedBy = this.dependencyBlockedBy(module)
      const state = this.write(module, available && !dependencyBlockedBy ? 'central-active' : 'central-ready')
      if (state === 'central-active' && current.localRecords === 0) this.writeVersion(module, MODULE_CONTRACT_VERSIONS[module] || 1)
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

module.exports = { ModuleStorageStateService, MODULE_DEPENDENCIES, MODULE_CONTRACT_VERSIONS }
