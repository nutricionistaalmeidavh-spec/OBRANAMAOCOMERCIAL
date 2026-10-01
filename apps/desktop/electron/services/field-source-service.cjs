function withoutRevision(value) {
  if (!value || typeof value !== 'object') return value
  const { revision: _revision, ...clean } = value
  return clean
}

function remotePayload(payload = {}) {
  const { revision, expectedRevision, equipe = [], equipamentos = [], ocorrencias = [], anexos = [], ...root } = payload
  return {
    ...root,
    ...(root.id ? { expectedRevision: expectedRevision ?? revision } : {}),
    equipe: equipe.map(withoutRevision),
    equipamentos: equipamentos.map(withoutRevision),
    ocorrencias: ocorrencias.map(withoutRevision),
    anexos: anexos.map(withoutRevision)
  }
}

class FieldSourceService {
  constructor({ local, lanClient, moduleStorage }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
  }

  async saveDailyReport(payload) {
    const state = this.moduleStorage.state('operation').state
    if (state === 'local' || state === 'migration-required') return this.local.saveDailyReport(payload)
    if (state === 'central-active') return this.lanClient.saveDailyReport(remotePayload(payload))
    throw new Error('O RDO central ainda não está ativo neste computador. Conclua o pareamento/capability do servidor antes de salvar.')
  }
}

module.exports = { FieldSourceService }
