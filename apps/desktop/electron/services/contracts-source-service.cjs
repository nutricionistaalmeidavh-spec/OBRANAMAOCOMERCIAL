const { randomUUID: defaultRandomUUID } = require('node:crypto')

class ContractsSourceService {
  constructor({ local, lanClient, moduleStorage, dataAccess, product, randomUUID = defaultRandomUUID }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.dataAccess = dataAccess
    this.product = product
    this.randomUUID = randomUUID
    this.pending = new Map()
  }

  state() { return this.moduleStorage.state('finance').state }
  blocked() { throw new Error('Contratos centrais ainda não estão ativos; nenhum dado será salvo localmente como fallback.') }

  request(kind, payload) {
    const key = kind + ':' + JSON.stringify(payload || {})
    if (!this.pending.has(key)) this.pending.set(key, this.randomUUID())
    return { key, requestId:this.pending.get(key) }
  }

  async createReceivable(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.createReceivable(payload)
    if (state !== 'central-active') return this.blocked()

    const edition = this.product?.getEdition?.()?.edition || 'construtora'
    if (payload?.id) {
      const { revision, expectedRevision, ...rest } = payload
      return this.lanClient.contractCreate({
        ...rest,
        expectedRevision:expectedRevision ?? revision,
        edition
      })
    }

    const { key, requestId } = this.request('contract', payload)
    try {
      const result = await this.lanClient.contractCreate({ ...payload, requestId, edition })
      this.pending.delete(key)
      return result
    } catch (error) {
      throw error
    }
  }

  async createAddendum(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.createAddendum(payload)
    if (state !== 'central-active') return this.blocked()

    const contract = await this.dataAccess.get('contratos_obra', Number(payload.contrato_id))
    if (!contract) throw new Error('Contrato central não encontrado.')
    const { key, requestId } = this.request('addendum', payload)
    try {
      const result = await this.lanClient.contractAddendum({
        ...payload,
        requestId,
        expectedContractRevision:contract.revision
      })
      this.pending.delete(key)
      return result
    } catch (error) {
      throw error
    }
  }
}

module.exports = { ContractsSourceService }
