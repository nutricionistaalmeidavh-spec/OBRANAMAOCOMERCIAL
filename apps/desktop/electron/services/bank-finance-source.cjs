'use strict'

// One domain service for both local SQLite and the Obra na Mão Server.
// Never fall back to a local write when the finance module is server-owned.
const METHODS = Object.freeze({
  listAccounts: 'bankList',
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
  listCompanies: 'bankCompanies',
  listWorks: 'bankWorks',
  listPlannedAccounts: 'bankPlannedAccounts',
  assignPlannedBank: 'bankPlanAssignment'
})
class BankFinanceSourceService {
  constructor({ local, lanClient, moduleStorage }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
  }
  call(method, payload) {
    const state = this.moduleStorage.state('finance').state
    if (state === 'local' || state === 'migration-required') return this.local[method](payload)
    if (state === 'central-active') return this.lanClient[METHODS[method]](payload)
    throw new Error('Financeiro central indisponível. Nenhum dado foi gravado localmente.')
  }
  listAccounts(payload) { return this.call('listAccounts', payload) }
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
  listCompanies(payload) { return this.call('listCompanies', payload) }
  listWorks(payload) { return this.call('listWorks', payload) }
  listPlannedAccounts(payload) { return this.call('listPlannedAccounts', payload) }
  assignPlannedBank(payload) { return this.call('assignPlannedBank', payload) }
}
module.exports = { BankFinanceSourceService }