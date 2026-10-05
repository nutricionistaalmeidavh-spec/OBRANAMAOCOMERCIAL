class MeasurementSourceService {
  constructor({ local, lanClient, moduleStorage }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
  }

  state() { return this.moduleStorage.state('planning').state }

  async saveWithItems(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.saveMeasurement(payload)
    if (state !== 'central-active') throw new Error('Medições centrais ainda não estão ativas; nenhum dado será salvo localmente como fallback.')
    const { revision, expectedRevision, ...rest } = payload || {}
    return this.lanClient.saveMeasurement({
      ...rest,
      ...(rest.id ? { expectedRevision: expectedRevision ?? revision } : {})
    })
  }
}

module.exports = { MeasurementSourceService }
