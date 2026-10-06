class RhSourceService {
  constructor({ localPayroll, localTime, lanClient, moduleStorage }) {
    this.localPayroll = localPayroll
    this.localTime = localTime
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.payrollRevisions = new Map()
    this.timeRevisions = new Map()
  }

  state() {
    return this.moduleStorage.state('rh').state
  }

  blocked() {
    throw new Error('O RH central ainda não está ativo neste computador; nenhum dado será salvo localmente como fallback.')
  }

  payrollKey(payload = {}) {
    return `${Number(payload.funcionario_id)}:${String(payload.competencia || '')}`
  }

  timeKey(payload = {}) {
    return `${Number(payload.funcionario_id)}:${String(payload.competencia || '')}`
  }

  async localOrCentral(localCall, centralCall) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return await localCall()
    if (state === 'central-active') return await centralCall()
    return this.blocked()
  }

  async getEmployee(payload) {
    return this.localOrCentral(
      () => this.localPayroll.getEmployee(payload),
      async () => {
        const result = await this.lanClient.payrollEmployee(payload)
        if (Number.isFinite(Number(result?.sheet?.revision))) this.payrollRevisions.set(this.payrollKey(payload), Number(result.sheet.revision))
        return result
      }
    )
  }

  async saveVariable(payload) {
    return this.localOrCentral(
      () => this.localPayroll.saveVariable(payload),
      () => this.lanClient.payrollSaveVariable(payload)
    )
  }

  async removeVariable(id) {
    return this.localOrCentral(
      () => this.localPayroll.removeVariable(id),
      () => this.lanClient.payrollRemoveVariable(id)
    )
  }

  async confirm(payload) {
    return this.localOrCentral(
      () => this.localPayroll.confirm(payload),
      async () => {
        const key = this.payrollKey(payload)
        const expectedRevision = payload.expectedRevision ?? this.payrollRevisions.get(key)
        const result = await this.lanClient.payrollConfirm({ ...payload, expectedRevision })
        if (Number.isFinite(Number(result?.sheetRevision))) this.payrollRevisions.set(key, Number(result.sheetRevision))
        return result
      }
    )
  }

  async overview(payload) {
    return this.localOrCentral(
      () => this.localPayroll.overview(payload),
      () => this.lanClient.payrollOverview(payload)
    )
  }

  async pending(competencia) {
    return this.localOrCentral(
      () => this.localPayroll.pending(competencia),
      () => this.lanClient.payrollPending(competencia)
    )
  }

  async timeGet(payload) {
    return this.localOrCentral(
      () => this.localTime.get(payload),
      async () => {
        const result = await this.lanClient.timeGet(payload)
        if (Number.isFinite(Number(result?.point?.revision))) this.timeRevisions.set(this.timeKey(payload), Number(result.point.revision))
        return result
      }
    )
  }

  async timeAutoFill(payload) {
    return this.localOrCentral(
      () => this.localTime.autoFill(payload),
      async () => {
        const key = this.timeKey(payload)
        const expectedRevision = payload.expectedRevision ?? this.timeRevisions.get(key)
        const result = await this.lanClient.timeAutoFill({ ...payload, expectedRevision })
        if (Number.isFinite(Number(result?.point?.revision))) this.timeRevisions.set(key, Number(result.point.revision))
        return result
      }
    )
  }

  async timeSave(payload) {
    return this.localOrCentral(
      () => this.localTime.save(payload),
      async () => {
        const key = this.timeKey(payload)
        const expectedRevision = payload.expectedRevision ?? this.timeRevisions.get(key)
        const result = await this.lanClient.timeSave({ ...payload, expectedRevision })
        if (Number.isFinite(Number(result?.point?.revision))) this.timeRevisions.set(key, Number(result.point.revision))
        return result
      }
    )
  }

  async timeDocumentContext(payload) {
    const state = this.state()
    if (state === 'central-active') return await this.lanClient.timeDocumentContext(payload)
    if (state === 'central-ready') return this.blocked()
    if (typeof this.localTime.documentContext === 'function') return await this.localTime.documentContext(payload)
    return null
  }

  get(payload) { return this.timeGet(payload) }
  autoFill(payload) { return this.timeAutoFill(payload) }
  save(payload) { return this.timeSave(payload) }
}

module.exports = { RhSourceService }
