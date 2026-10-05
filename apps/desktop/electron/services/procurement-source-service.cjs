const { randomUUID: defaultRandomUUID } = require('node:crypto')

class ProcurementSourceService {
  constructor({ local, lanClient, moduleStorage, randomUUID = defaultRandomUUID }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.randomUUID = randomUUID
    this.pending = new Map()
  }

  state() { return this.moduleStorage.state('finance').state }
  blocked() { throw new Error('Compras/estoque centrais ainda não estão ativos; nenhum dado será salvo localmente como fallback.') }

  key(kind, payload) {
    return kind + ':' + JSON.stringify(payload || {})
  }

  requestId(kind, payload) {
    const key = this.key(kind, payload)
    if (!this.pending.has(key)) this.pending.set(key, this.randomUUID())
    return { key, requestId:this.pending.get(key) }
  }

  async central(kind, payload, fn) {
    const { key, requestId } = this.requestId(kind, payload)
    try {
      const result = await fn(requestId)
      this.pending.delete(key)
      return result
    } catch (error) {
      throw error
    }
  }

  async summary(obraId) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.summary(obraId)
    if (state === 'central-active') return this.lanClient.procurementSummary(obraId)
    return this.blocked()
  }

  async createOrder(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.createOrder(payload)
    if (state !== 'central-active') return this.blocked()
    return this.central('order', payload, requestId => this.lanClient.procurementCreateOrder({ ...payload, requestId }))
  }

  async receiveMaterial(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.receiveMaterial(payload)
    if (state !== 'central-active') return this.blocked()
    return this.central('receive', payload, requestId => this.lanClient.procurementReceiveMaterial({ ...payload, requestId }))
  }

  async moveStock(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.moveStock(payload)
    if (state !== 'central-active') return this.blocked()
    return this.central('stock', payload, requestId => this.lanClient.procurementMoveStock({ ...payload, requestId }))
  }
}

module.exports = { ProcurementSourceService }
