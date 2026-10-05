class MeasurementSourceService {
  constructor({ local, lanClient, moduleStorage }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
  }

  route() {
    const state = this.moduleStorage?.state?.('planning')?.state || 'local'
    if (state === 'central-active') return 'central'
    if (state === 'central-ready') return 'blocked'
    return 'local'
  }

  async saveWithItems(payload) {
    const route = this.route()
    if (route === 'central') return this.lanClient.saveMeasurement(payload)
    if (route === 'blocked') throw new Error('Medições centrais ainda não estão ativas; nenhum dado será salvo localmente como fallback.')
    return this.local.saveMeasurement(payload)
  }
}

module.exports = { MeasurementSourceService }
