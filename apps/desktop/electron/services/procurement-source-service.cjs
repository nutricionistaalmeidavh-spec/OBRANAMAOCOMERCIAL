class ProcurementSourceService {
  constructor({ local, lanClient, moduleStorage }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
  }

  route() {
    const state = this.moduleStorage?.state?.('finance')?.state || 'local'
    if (state === 'central-active') return 'central'
    if (state === 'central-ready') return 'blocked'
    return 'local'
  }

  blocked() { throw new Error('Compras/estoque centrais ainda não estão ativos; nenhum dado será salvo localmente como fallback.') }

  async summary(obraId) {
    const route = this.route()
    if (route === 'central') return this.lanClient.procurementSummary(obraId)
    if (route === 'blocked') return this.blocked()
    return this.local.summary(obraId)
  }

  async createOrder(payload) {
    const route = this.route()
    if (route === 'central') return this.lanClient.procurementCreateOrder(payload)
    if (route === 'blocked') return this.blocked()
    return this.local.createOrder(payload)
  }

  async receiveMaterial(payload) {
    const route = this.route()
    if (route === 'central') return this.lanClient.procurementReceiveMaterial(payload)
    if (route === 'blocked') return this.blocked()
    return this.local.receiveMaterial(payload)
  }

  async moveStock(payload) {
    const route = this.route()
    if (route === 'central') return this.lanClient.procurementMoveStock(payload)
    if (route === 'blocked') return this.blocked()
    return this.local.moveStock(payload)
  }
}

module.exports = { ProcurementSourceService }
