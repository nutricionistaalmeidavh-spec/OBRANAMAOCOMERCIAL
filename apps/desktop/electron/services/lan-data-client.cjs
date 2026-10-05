const { RevisionConflictError } = require('./revision-conflict-error.cjs')

const CORE_REMOTE_TABLES = new Set(['empresas', 'clientes', 'obras'])
const OPERATION_REMOTE_TABLES = new Set(['locais_obra', 'frentes_obra', 'subfrentes_obra', 'checklist_frente_itens', 'tarefas_obra', 'rdos', 'rdo_equipe', 'rdo_equipamentos', 'rdo_ocorrencias', 'rdo_anexos'])
const PLANNING_REMOTE_TABLES = new Set(['fontes_documentais', 'etapas_obra', 'cronograma_etapas', 'itens_orcamentarios', 'medicoes', 'medicao_itens', 'medicao_mapa_itens'])
const FINANCE_REMOTE_TABLES = new Set(['fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta', 'solicitacoes_compra', 'cotacoes_compra', 'pedidos_compra', 'pedido_compra_itens', 'recebimentos_materiais', 'movimentacoes_estoque', 'contratos_obra', 'contrato_aditivos'])
const RH_REMOTE_TABLES = new Set([
  'funcionarios', 'funcionario_obras', 'cargos', 'beneficios', 'cargo_beneficios', 'funcionario_beneficios',
  'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes',
  'epis', 'funcionario_epis', 'arquivos', 'documentos', 'medicao_anexos', 'contrato_anexos', 'pedido_compra_anexos', 'documentos_editaveis', 'modelos_documento_rh'
])
const REMOTE_TABLES = new Set([...CORE_REMOTE_TABLES, ...OPERATION_REMOTE_TABLES, ...PLANNING_REMOTE_TABLES, ...FINANCE_REMOTE_TABLES, ...RH_REMOTE_TABLES])
const TERMINAL_AUTH_ERRORS = new Set(['invalid_device_token','device_revoked','member_not_authorized','desktop_channel_required'])

class LanDataClient {
  constructor({ storage, credentials, fetchImpl = globalThis.fetch, timeoutMs = 5000 }) {
    this.storage = storage
    this.credentials = credentials
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  assertTable(table) {
    if (!REMOTE_TABLES.has(table)) throw new Error('Entidade ainda não disponível no servidor da empresa.')
  }

  connection() {
    const state = this.storage.state()
    if (state.mode !== 'server' || !state.baseUrl) throw new Error('Servidor da empresa não está configurado.')
    const serverKey = String(state.serverId || state.serverKey || state.baseUrl)
    const token = this.credentials?.token?.(serverKey) || ''
    if (!token) throw new Error('Este computador ainda não está pareado/autorizado neste servidor da empresa.')
    return { ...state, serverKey, token }
  }

  sanitizeMessage(message, token) {
    const value = String(message || '')
    return token ? value.split(token).join('[credencial protegida]') : value
  }

  async request(method, path, { query, body } = {}) {
    const state = this.connection()
    const url = new URL(`${state.baseUrl}${path}`)
    for (const [key, value] of Object.entries(query || {})) {
      if (value === '' || value === null || value === undefined) continue
      url.searchParams.set(key, String(value))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${state.token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      })
      let payload = null
      try { payload = await response.json() } catch {}
      if (!response?.ok) {
        if (response?.status === 409 && payload?.error === 'revision_conflict') {
          throw new RevisionConflictError(payload)
        }
        if (TERMINAL_AUTH_ERRORS.has(String(payload?.error || ''))) this.credentials?.clear?.(state.serverKey)
        const rawMessage = payload?.message || `Servidor da empresa respondeu HTTP ${response?.status ?? 'inválido'}.`
        throw new Error(this.sanitizeMessage(rawMessage, state.token))
      }
      return payload
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Tempo esgotado ao acessar o servidor da empresa.')
      if (error instanceof RevisionConflictError) throw error
      if (error instanceof Error) throw new Error(this.sanitizeMessage(error.message, state.token))
      throw new Error('Não foi possível acessar o servidor da empresa.')
    } finally {
      clearTimeout(timer)
    }
  }

  async syncSourceCapabilities() {
    return this.request('GET', '/api/v1/sync-source/capabilities')
  }

  async migrationStart(input) {
    return this.request('POST', '/api/v1/migrations/start', { body: input })
  }

  async migrationRecord(migrationId, record) {
    return this.request('POST', `/api/v1/migrations/${encodeURIComponent(String(migrationId))}/record`, { body: record })
  }

  async migrationStatus(migrationId) {
    return this.request('GET', `/api/v1/migrations/${encodeURIComponent(String(migrationId))}/status`)
  }

  async migrationValidate(migrationId) {
    return this.request('POST', `/api/v1/migrations/${encodeURIComponent(String(migrationId))}/validate`)
  }

  async migrationCommit(migrationId) {
    return this.request('POST', `/api/v1/migrations/${encodeURIComponent(String(migrationId))}/commit`)
  }

  async migrationRollback(migrationId) {
    return this.request('POST', `/api/v1/migrations/${encodeURIComponent(String(migrationId))}/rollback`)
  }

  async saveDailyReport(payload) {
    return this.request('POST', '/api/v1/field/rdo', { body: payload })
  }

  async planningOverview(obraId) {
    return this.request('GET', '/api/v1/planning/overview', { query: { obra_id: Number(obraId) } })
  }

  async saveMeasurement(payload) {
    return this.request('POST', '/api/v1/measurements/save', { body: payload })
  }

  async procurementSummary(obraId) {
    return this.request('GET', '/api/v1/procurement/summary', { query: { obra_id: Number(obraId) } })
  }

  async procurementCreateOrder(payload) {
    return this.request('POST', '/api/v1/procurement/order', { body: payload })
  }

  async procurementReceiveMaterial(payload) {
    return this.request('POST', '/api/v1/procurement/receive', { body: payload })
  }

  async procurementMoveStock(payload) {
    return this.request('POST', '/api/v1/procurement/stock', { body: payload })
  }

  async contractCreate(payload) {
    return this.request('POST', '/api/v1/contracts/create', { body: payload })
  }

  async contractAddendum(payload) {
    return this.request('POST', '/api/v1/contracts/addendum', { body: payload })
  }

  async accountPayment(id, payment, requestId) {
    return this.request('POST', `/api/v1/finance/accounts/${Number(id)}/payment`, { body: { requestId, payment } })
  }

  async financeDre(filters = {}) {
    return this.request('GET', '/api/v1/finance/dre', { query: filters })
  }

  async financeDashboard(filters = {}) {
    return this.request('GET', '/api/v1/finance/dashboard', { query: filters })
  }

  async saveCompensationPolicy(payload) {
    return this.request('POST', '/api/v1/rh/catalog/compensation-policy', { body: payload })
  }

  async payrollEmployee(payload) {
    return this.request('POST', '/api/v1/rh/payroll/employee', { body: payload })
  }

  async payrollSaveVariable(payload) {
    return this.request('POST', '/api/v1/rh/payroll/save-variable', { body: payload })
  }

  async payrollRemoveVariable(id) {
    return this.request('POST', '/api/v1/rh/payroll/remove-variable', { body: { id: Number(id) } })
  }

  async payrollConfirm(payload) {
    return this.request('POST', '/api/v1/rh/payroll/confirm', { body: payload })
  }

  async payrollPending(competencia) {
    return this.request('POST', '/api/v1/rh/payroll/pending', { body: { competencia } })
  }

  async timeGet(payload) {
    return this.request('POST', '/api/v1/rh/time/get', { body: payload })
  }

  async timeAutoFill(payload) {
    return this.request('POST', '/api/v1/rh/time/auto-fill', { body: payload })
  }

  async timeSave(payload) {
    return this.request('POST', '/api/v1/rh/time/save', { body: payload })
  }

  async timeDocumentContext(payload) {
    return this.request('POST', '/api/v1/rh/time/document-context', { body: payload })
  }

  async list(table, filters = {}) {
    this.assertTable(table)
    return this.request('GET', `/api/v1/${table}`, { query: filters })
  }

  async get(table, id) {
    this.assertTable(table)
    return this.request('GET', `/api/v1/${table}/${Number(id)}`)
  }

  async save(table, data) {
    this.assertTable(table)
    const id = data?.id ? Number(data.id) : null
    const body = { ...(data || {}) }
    delete body.id
    if (!id) {
      delete body.revision
      return this.request('POST', `/api/v1/${table}`, { body })
    }
    const expectedRevision = data?.revision
    delete body.revision
    return this.request('PUT', `/api/v1/${table}/${id}`, { body: { expectedRevision, data: body } })
  }

  async remove(table, id, expectedRevision) {
    this.assertTable(table)
    await this.request('DELETE', `/api/v1/${table}/${Number(id)}`, { query: { expectedRevision } })
    return true
  }
}

module.exports = { LanDataClient, LanRevisionConflictError: RevisionConflictError, RevisionConflictError, REMOTE_TABLES, CORE_REMOTE_TABLES, OPERATION_REMOTE_TABLES, PLANNING_REMOTE_TABLES, FINANCE_REMOTE_TABLES, RH_REMOTE_TABLES }
