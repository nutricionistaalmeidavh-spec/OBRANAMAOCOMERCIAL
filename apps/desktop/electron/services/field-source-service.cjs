class FieldSourceService {
  constructor({ local, lanClient, moduleStorage }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
  }

  async saveDailyReport(payload) {
    const state = this.moduleStorage.state('operation').state
    if (state === 'local' || state === 'migration-required') return this.local.saveDailyReport(payload)
    if (state === 'central-active') return this.lanClient.saveDailyReport(payload)
    throw new Error('O RDO central ainda não está ativo neste computador. Conclua o pareamento/capability do servidor antes de salvar.')
  }
}

module.exports = { FieldSourceService }
