const { randomUUID: defaultRandomUUID } = require('node:crypto')

class FinanceSourceService {
  constructor({ local, lanClient, moduleStorage, randomUUID = defaultRandomUUID }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.randomUUID = randomUUID
    this.pendingPaymentRequests = new Map()
  }

  state() {
    return this.moduleStorage.state('finance').state
  }

  blocked() {
    throw new Error('O Financeiro central ainda não está ativo neste computador; nenhum dado será salvo localmente como fallback.')
  }

  paymentKey(id, payment) {
    return JSON.stringify([
      Number(id),
      Number(payment?.valor_centavos),
      String(payment?.data || ''),
      payment?.forma_pagamento || null,
      payment?.observacoes || null
    ])
  }

  async accountPayment(id, payment) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.accountPayment(id, payment)
    if (state !== 'central-active') return this.blocked()

    const key = this.paymentKey(id, payment)
    let requestId = this.pendingPaymentRequests.get(key)
    if (!requestId) {
      requestId = this.randomUUID()
      this.pendingPaymentRequests.set(key, requestId)
    }
    try {
      const result = await this.lanClient.accountPayment(id, payment, requestId)
      this.pendingPaymentRequests.delete(key)
      return result
    } catch (error) {
      throw error
    }
  }

  async dre(filters = {}) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.dre(filters)
    if (state === 'central-active') return this.lanClient.financeDre(filters)
    return this.blocked()
  }

  async dashboard(filters = {}) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.dashboard(filters)
    if (state === 'central-active') return this.lanClient.financeDashboard(filters)
    return this.blocked()
  }
}

module.exports = { FinanceSourceService }
