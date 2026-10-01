class RhSourceService {
  constructor({ localPayroll, localTime, lanClient, moduleStorage }) {
    this.localPayroll = localPayroll
    this.localTime = localTime
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
  }

  state() {
    return this.moduleStorage.state('rh').state
  }

  blocked() {
    throw new Error('O RH central ainda não está ativo neste computador; nenhum dado será salvo localmente como fallback.')
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
      () => this.lanClient.payrollEmployee(payload)
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
      () => this.lanClient.payrollConfirm(payload)
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
      () => this.lanClient.timeGet(payload)
    )
  }

  async timeAutoFill(payload) {
    return this.localOrCentral(
      () => this.localTime.autoFill(payload),
      () => this.lanClient.timeAutoFill(payload)
    )
  }

  async timeSave(payload) {
    return this.localOrCentral(
      () => this.localTime.save(payload),
      () => this.lanClient.timeSave(payload)
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
