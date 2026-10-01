class PlanningSourceService {
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

  async overview(obraId) {
    const route = this.route()
    if (route === 'central') return this.lanClient.planningOverview(Number(obraId))
    if (route === 'blocked') throw new Error('O Planejamento central ainda não está ativo; nenhum dado será lido localmente como fallback.')
    return this.local.overview(Number(obraId))
  }
}

module.exports = { PlanningSourceService }
