class ContractsSourceService {
  constructor({ local, lanClient, moduleStorage, product }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.product = product
  }

  route() {
    const state = this.moduleStorage?.state?.('finance')?.state || 'local'
    if (state === 'central-active') return 'central'
    if (state === 'central-ready') return 'blocked'
    return 'local'
  }

  blocked() { throw new Error('Contratos centrais ainda não estão ativos; nenhum dado será salvo localmente como fallback.') }

  async createReceivable(payload) {
    const route = this.route()
    if (route === 'central') {
      const edition = this.product?.getEdition?.()?.edition || 'construtora'
      return this.lanClient.contractCreate({ ...payload, edition })
    }
    if (route === 'blocked') return this.blocked()
    return this.local.createReceivable(payload)
  }

  async createAddendum(payload) {
    const route = this.route()
    if (route === 'central') return this.lanClient.contractAddendum(payload)
    if (route === 'blocked') return this.blocked()
    return this.local.createAddendum(payload)
  }
}

module.exports = { ContractsSourceService }
