'use strict'
const {localFinanceActor}=require('./desktop-finance-identity.cjs')
const AUDITED_OPERATIONS=new Set(['confirmReconciliation','reverseReconciliation','closePeriod','reopenPeriod','captureForecast','recordManualBalance'])

// One domain service for both local SQLite and the Obra na Mão Server.
// Never fall back to a local write when the finance module is server-owned.
const METHODS = Object.freeze({
  listAccounts: 'bankList',
  listManualBalances: 'bankManualBalances',
  recordManualBalance: 'bankRecordBalance',
  saveAccount: 'bankSave',
  previewImport: 'bankPreview',
  confirmImport: 'bankConfirm',
  listImports: 'bankImports',
  listTransactions: 'bankTransactions',
  suggestReconciliation: 'bankSuggestions',
  confirmReconciliation: 'bankReconcile',
  reverseReconciliation: 'bankReverse',
  listReconciliations: 'bankReconciliations',
  cashFlow: 'bankCashFlow',
  listWorks: 'bankWorks',
  listPlannedAccounts: 'bankPlannedAccounts',
  assignPlannedBank: 'bankPlanAssignment',
  auditPeriod: 'bankAudit',
  periodStatus: 'bankPeriodStatus',
  periodEvents: 'bankPeriodEvents',
  closePeriod: 'bankPeriodClose',
  reopenPeriod: 'bankPeriodReopen',
  simulateCashFlow: 'bankSimulateCash',
  cashReport: 'bankCashReport',
  captureForecast: 'bankCaptureForecast',
  listForecasts: 'bankListForecasts'
})
class BankFinanceSourceService {
  constructor({ local, lanClient, moduleStorage, actorProvider=localFinanceActor }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.actorProvider = actorProvider
  }
  call(method, payload) {
    const state = this.moduleStorage.state('finance').state
    const safePayload=AUDITED_OPERATIONS.has(method)?{...payload}:payload
    if(AUDITED_OPERATIONS.has(method))delete safePayload.actorId // Nunca confiar no renderer para auditoria
    if (state === 'local' || state === 'migration-required') return this.local[method](AUDITED_OPERATIONS.has(method)?{...safePayload,actorId:this.actorProvider()}:safePayload)
    if (state === 'central-active') return this.lanClient[METHODS[method]](safePayload)
    throw new Error('Financeiro central indisponível. Nenhum dado foi gravado localmente.')
  }
  listAccounts(payload) { return this.call('listAccounts', payload) }
  listManualBalances(payload) { return this.call('listManualBalances', payload) }
  recordManualBalance(payload) { return this.call('recordManualBalance', payload) }
  saveAccount(payload) { return this.call('saveAccount', payload) }
  previewImport(payload) { return this.call('previewImport', payload) }
  confirmImport(payload) { return this.call('confirmImport', payload) }
  listImports(payload) { return this.call('listImports', payload) }
  listTransactions(payload) { return this.call('listTransactions', payload) }
  suggestReconciliation(payload) { return this.call('suggestReconciliation', payload) }
  confirmReconciliation(payload) { return this.call('confirmReconciliation', payload) }
  reverseReconciliation(payload) { return this.call('reverseReconciliation', payload) }
  listReconciliations(payload) { return this.call('listReconciliations', payload) }
  cashFlow(payload) { return this.call('cashFlow', payload) }
  listWorks(payload) { return this.call('listWorks', payload) }
  listPlannedAccounts(payload) { return this.call('listPlannedAccounts', payload) }
  assignPlannedBank(payload) { return this.call('assignPlannedBank', payload) }
  auditPeriod(payload) { return this.call('auditPeriod', payload) }
  periodStatus(payload) { return this.call('periodStatus', payload) }
  periodEvents(payload) { return this.call('periodEvents', payload) }
  closePeriod(payload) { return this.call('closePeriod', payload) }
  reopenPeriod(payload) { return this.call('reopenPeriod', payload) }
  simulateCashFlow(payload) { return this.call('simulateCashFlow', payload) }
  cashReport(payload) { return this.call('cashReport', payload) }
  captureForecast(payload) { return this.call('captureForecast', payload) }
  listForecasts(payload) { return this.call('listForecasts', payload) }
}
module.exports = { BankFinanceSourceService }