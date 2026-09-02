const { contextBridge, ipcRenderer } = require('electron')

async function call(channel, payload) {
  const response = await ipcRenderer.invoke(channel, payload)
  if (!response?.ok) { const error = new Error(response?.error?.message || 'Não foi possível concluir a operação.'); error.details = response?.error?.details; throw error }
  return response.data
}
const entity = (table) => ({ list: (filters) => call('entity:list', { table, filters }), get: (id) => call('entity:get', { table, id }), save: (data) => call('entity:save', { table, data }), remove: (id) => call('entity:remove', { table, id }) })

contextBridge.exposeInMainWorld('fluxoDre', {
  app: { bootstrap: () => call('app:bootstrap'), retryDatabase: () => call('app:retry-database'), getLayout: () => call('app:get-layout'), setLayout: (layout) => call('app:set-layout', { layout }) }, product: { getEdition: () => call('product:get-edition'), setEdition: (edition) => call('product:set-edition', { edition }) }, demo: { seed: () => call('demo:seed') },
  empresas: entity('empresas'), clientes: entity('clientes'), fornecedores: entity('fornecedores'), obras: { ...entity('obras'), importSpreadsheets: () => call('works:import-spreadsheets'), overview: (obra_id) => call('works:overview', { obra_id }), timeline: (obra_id) => call('works:timeline', { obra_id }) }, etapas: entity('etapas_obra'), locais: entity('locais_obra'), orcamentos: entity('itens_orcamentarios'), cronograma: entity('cronograma_etapas'), rdos: entity('rdos'), rdoEquipe: entity('rdo_equipe'), rdoEquipamentos: entity('rdo_equipamentos'), rdoOcorrencias: entity('rdo_ocorrencias'), rdoAnexos: entity('rdo_anexos'),
  medicoes: { ...entity('medicoes'), saveWithItems: (data) => call('measurements:save', data), anexos: entity('medicao_anexos'), itensMedidos: entity('medicao_itens'), importAttachment: (data) => call('files:import-measurement', data), mapa: entity('medicao_mapa_itens') }, contas: { ...entity('contas'), payment: (id, payment) => call('accounts:payment', { id, payment }) },
  categorias: entity('categorias_financeiras'), cargos: entity('cargos'), funcionarios: entity('funcionarios'), folhas: entity('folhas_pagamento'), lancamentosFolha: entity('folha_lancamentos'), pagamentosFuncionario: entity('pagamentos_funcionario'), beneficios: entity('beneficios'),
  epis: entity('epis'), funcionarioEpis: entity('funcionario_epis'), arquivos: entity('arquivos'), fontes: entity('fontes_documentais'), pastas: entity('pastas_vinculadas'),
  documentos: { ...entity('documentos'), generate: (data) => call('documents:generate', data), templates: () => call('documents:templates'), saveTemplate: (data) => call('documents:save-template', data), chooseLocalTemplate: () => call('documents:choose-local-template'), setDefaultTemplate: (data) => call('documents:set-default-template', data), importForEmployee: (data) => call('files:import-employee', data), importForWork: (data) => call('files:import-work-document', data), open: (path) => call('files:open', { path }), reveal: (path) => call('files:reveal', { path }), copyPath: (path) => call('files:copy-path', { path }), openFolder: () => call('files:open-folder'), chooseRoot: () => call('files:choose-root'), getRoot: () => call('files:get-root'), delete: (data) => call('documents:delete', data) },
  planejamento: { overview: (obra_id) => call('planning:overview', { obra_id }) }, campo: { saveRdo: (data) => call('field:save-rdo', data) }, tarefas: entity('tarefas_obra'), compras: { ...entity('solicitacoes_compra'), cotacoes: entity('cotacoes_compra'), pedidos: entity('pedidos_compra'), itens: entity('pedido_compra_itens'), recebimentos: entity('recebimentos_materiais'), estoque: entity('movimentacoes_estoque'), summary: (obra_id) => call('procurement:summary', { obra_id }), createOrder: (data) => call('procurement:create-order', data), receiveMaterial: (data) => call('procurement:receive-material', data), moveStock: (data) => call('procurement:move-stock', data) }, contratos: { ...entity('contratos_obra'), aditivos: entity('contrato_aditivos'), create: (data) => call('contracts:create', data), addendum: (data) => call('contracts:addendum', data) }, frentes: entity('frentes_obra'), subfrentes: entity('subfrentes_obra'), checklistFrente: entity('checklist_frente_itens'),
  folha: { employee: (data) => call('payroll:employee', data), saveVariable: (data) => call('payroll:save-variable', data), removeVariable: (id) => call('payroll:remove-variable', { id }), confirm: (data) => call('payroll:confirm', data), pending: (competencia) => call('payroll:pending', { competencia }) },
  ponto: { get: (data) => call('time:get', data), autoFill: (data) => call('time:auto-fill', data), save: (data) => call('time:save', data), generate: (data) => call('time:generate', data), generateAll: (data) => call('time:generate-all', data) },
  catalogo: { list: () => call('catalog:list'), saveCargo: (data) => call('catalog:save-cargo', data), saveBenefit: (data) => call('catalog:save-benefit', data), saveLink: (data) => call('catalog:save-link', data), deactivate: (type,id) => call('catalog:deactivate', { type,id }) },
  importacoes: { ...entity('importacoes'), preview: () => call('imports:preview'), commit: (token) => call('imports:commit', { token }) },
  importadorUniversal: { choose: () => call('universal-import:choose'), preview: (token, options) => call('universal-import:preview', { token, options }), commit: (token, options) => call('universal-import:commit', { token, options }) },
  relatorios: { dashboard: (filters) => call('dashboard:get', filters), dre: (filters) => call('dre:get', filters) },
  online: {
    state: () => call('online:state'),
    start: (activationCode) => call('online:start', { activationCode }),
    status: () => call('online:status'),
    session: () => call('online:session'),
    disconnect: () => call('online:disconnect'),
    syncPull: (sinceRevision) => call('online:sync-pull', { sinceRevision }),
    syncPush: (changes) => call('online:sync-push', { changes }),
    publishMobileSummary: (summary) => call('online:mobile-summary', { summary }),
    financeRead: (view) => call('online:finance-read', { view }),
    financeWrite: (action, input) => call('online:finance-write', { action, input }),
    publishFinanceReference: (obligations) => call('online:finance-reference', { obligations }),
    aiAnalyze: (input) => call('online:ai-analyze', input),
    conflicts: () => call('online:conflicts'),
    resolveConflict: (conflictId, resolution) => call('online:resolve-conflict', { conflictId, resolution })
  },
  backup: { create: () => call('backup:create'), restore: () => call('backup:restore'), openDataFolder: () => call('backup:open-data-folder') }
})
