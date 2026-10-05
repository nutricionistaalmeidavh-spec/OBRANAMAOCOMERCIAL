const { randomUUID: defaultRandomUUID } = require('node:crypto')

class MeasurementSourceService {
  constructor({ local, lanClient, moduleStorage, randomUUID = defaultRandomUUID }) {
    this.local = local
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.randomUUID = randomUUID
    this.pending = new Map()
  }

  state() { return this.moduleStorage.state('planning').state }

  requestId(payload) {
    const copy = { ...(payload || {}) }
    delete copy.revision
    delete copy.expectedRevision
    const key = JSON.stringify(copy)
    if (!this.pending.has(key)) this.pending.set(key, this.randomUUID())
    return { key, requestId:this.pending.get(key) }
  }

  async saveWithItems(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') {
      const { requestId, ...localPayload } = payload || {}
      return this.local.saveMeasurement(localPayload)
    }
    if (state !== 'central-active') throw new Error('Medições centrais ainda não estão ativas; nenhum dado será salvo localmente como fallback.')

    const { revision, expectedRevision, ...rest } = payload || {}
    if (rest.id) {
      return this.lanClient.saveMeasurement({
        ...rest,
        expectedRevision: expectedRevision ?? revision
      })
    }

    const { key, requestId } = this.requestId(rest)
    try {
      const result = await this.lanClient.saveMeasurement({ ...rest, requestId })
      this.pending.delete(key)
      return result
    } catch (error) {
      throw error
    }
  }
}

module.exports = { MeasurementSourceService }
