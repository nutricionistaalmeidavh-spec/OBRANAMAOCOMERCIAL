export const PERMISSION_DOMAINS = Object.freeze(['core', 'operation', 'planning', 'finance', 'rh', 'documents'])
export const PERMISSION_ACTIONS = Object.freeze(['view', 'create', 'edit', 'delete', 'approve'])

const CORE_TABLES = new Set(['empresas', 'clientes', 'obras'])
const OPERATION_TABLES = new Set(['locais_obra', 'frentes_obra', 'subfrentes_obra', 'checklist_frente_itens', 'tarefas_obra', 'rdos', 'rdo_equipe', 'rdo_equipamentos', 'rdo_ocorrencias', 'rdo_anexos'])
const PLANNING_TABLES = new Set(['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios', 'medicoes', 'medicao_itens', 'medicao_mapa_itens'])
const FINANCE_TABLES = new Set(['fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta', 'solicitacoes_compra', 'cotacoes_compra', 'pedidos_compra', 'pedido_compra_itens', 'recebimentos_materiais', 'movimentacoes_estoque', 'contratos_obra', 'contrato_aditivos'])
const DOCUMENT_TABLES = new Set(['fontes_documentais','arquivos','documentos','medicao_anexos','contrato_anexos','pedido_compra_anexos','documentos_editaveis','modelos_documento_rh','empresa_documentos_admissionais'])
const RH_TABLES = new Set([
  'funcionarios', 'funcionario_obras', 'cargos', 'beneficios', 'cargo_beneficios',
  'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos',
  'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'epis', 'funcionario_epis', 'cargo_epi_kits'
])

const DOMAIN_MODULES = Object.freeze({
  core: ['obra360'],
  operation: ['obra360', 'rdo'],
  planning: ['obra360'],
  finance: ['finance', 'dre'],
  rh: ['rh'],
  documents: ['documents']
})

export function domainForTable(table) {
  const name = String(table || '')
  if (CORE_TABLES.has(name)) return 'core'
  if (OPERATION_TABLES.has(name)) return 'operation'
  if (PLANNING_TABLES.has(name)) return 'planning'
  if (FINANCE_TABLES.has(name)) return 'finance'
  if (RH_TABLES.has(name)) return 'rh'
  if (DOCUMENT_TABLES.has(name)) return 'documents'
  return null
}

export function actionForCrudMethod(method) {
  switch (String(method || '').toUpperCase()) {
    case 'GET': return 'view'
    case 'POST': return 'create'
    case 'PUT':
    case 'PATCH': return 'edit'
    case 'DELETE': return 'delete'
    default: return null
  }
}

function moduleAllows(member, domain, action) {
  const modules = Array.isArray(member?.modules) ? member.modules.map(String) : []
  if (domain === 'finance' && modules.includes('dre') && !modules.includes('finance')) return action === 'view'
  return (DOMAIN_MODULES[domain] || []).some(module => modules.includes(module))
}

export function granularPermissionDecision(member, domain, action) {
  const normalizedDomain = String(domain || '')
  const normalizedAction = String(action || '')
  if (!PERMISSION_DOMAINS.includes(normalizedDomain) || !PERMISSION_ACTIONS.includes(normalizedAction)) return false
  if (member?.permissions === undefined || member?.permissions === null) return null
  if (!moduleAllows(member, normalizedDomain, normalizedAction)) return false
  const actions = member.permissions && typeof member.permissions === 'object'
    ? member.permissions[normalizedDomain]
    : null
  return Array.isArray(actions) && actions.map(String).includes(normalizedAction)
}
