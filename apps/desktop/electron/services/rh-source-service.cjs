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

  localOrCentral(localCall, centralCall) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return localCall()
    if (state === 'central-active') return centralCall()
    return this.blocked()
  }

  getEmployee(payload) {
    return this.localOrCentral(
      () => this.localPayroll.getEmployee(payload),
      () => this.lanClient.payrollEmployee(payload)
    )
  }

  saveVariable(payload) {
    return this.localOrCentral(
      () => this.localPayroll.saveVariable(payload),
      () => this.lanClient.payrollSaveVariable(payload)
    )
  }

  removeVariable(id) {
    return this.localOrCentral(
      () => this.localPayroll.removeVariable(id),
      () => this.lanClient.payrollRemoveVariable(id)
    )
  }

  confirm(payload) {
    return this.localOrCentral(
      () => this.localPayroll.confirm(payload),
      () => this.lanClient.payrollConfirm(payload)
    )
  }

  pending(competencia) {
    return this.localOrCentral(
      () => this.localPayroll.pending(competencia),
      () => this.lanClient.payrollPending(competencia)
    )
  }

  timeGet(payload) {
    return this.localOrCentral(
      () => this.localTime.get(payload),
      () => this.lanClient.timeGet(payload)
    )
  }

  timeAutoFill(payload) {
    return this.localOrCentral(
      () => this.localTime.autoFill(payload),
      () => this.lanClient.timeAutoFill(payload)
    )
  }

  timeSave(payload) {
    return this.localOrCentral(
      () => this.localTime.save(payload),
      () => this.lanClient.timeSave(payload)
    )
  }

  timeDocumentContext(payload) {
    const state = this.state()
    if (state === 'central-active') return this.lanClient.timeDocumentContext(payload)
    if (state === 'central-ready') return this.blocked()
    if (typeof this.localTime.documentContext === 'function') return this.localTime.documentContext(payload)
    return null
  }

  get(payload) { return this.timeGet(payload) }
  autoFill(payload) { return this.timeAutoFill(payload) }
  save(payload) { return this.timeSave(payload) }

  async centralContext(payload) {
    let context = await this.lanClient.timeDocumentContext(payload)
    if (!Array.isArray(context?.marks) || context.marks.length === 0) {
      await this.lanClient.timeAutoFill(payload)
      context = await this.lanClient.timeDocumentContext(payload)
    }
    return context
  }

  async centralPrintableEntry(employee, payload) {
    const context = await this.centralContext({ funcionario_id: employee.id, competencia: payload.competencia })
    return this.localTime.printableEntryFromContext(payload, context)
  }

  async generateDocuments(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.localTime.generateDocuments(payload)
    if (state !== 'central-active') return this.blocked()
    const context = await this.centralContext(payload)
    return this.localTime.generateDocumentsFromContext(payload, context)
  }

  async generateForAll(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.localTime.generateForAll(payload)
    if (state !== 'central-active') return this.blocked()

    const employees = (await this.lanClient.list('funcionarios', { status: 'ativo' }))
      .filter(employee => !employee.deleted_at && employee.status === 'ativo')
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))

    if (payload?.reprint) {
      const entries = []
      for (const employee of employees) {
        try { entries.push(await this.centralPrintableEntry(employee, payload)) }
        catch (error) { entries.push({ funcionario_id: employee.id, nome: employee.nome, ok: false, error: error instanceof Error ? error.message : String(error) }) }
      }
      const result = await this.localTime.printEntries(entries, payload)
      return { ...result, reprint: true, documentStorage: 'local-derived' }
    }

    const results = []
    for (const employee of employees) {
      try {
        results.push({ funcionario_id: employee.id, nome: employee.nome, ok: true, documents: await this.generateDocuments({ ...payload, funcionario_id: employee.id }) })
      } catch (error) {
        results.push({ funcionario_id: employee.id, nome: employee.nome, ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }

    if (payload?.print) {
      const entries = []
      for (const employee of employees.filter(item => results.some(result => result.ok && Number(result.funcionario_id) === Number(item.id)))) {
        try { entries.push(await this.centralPrintableEntry(employee, payload)) }
        catch (error) { entries.push({ funcionario_id: employee.id, nome: employee.nome, ok: false, error: error instanceof Error ? error.message : String(error) }) }
      }
      const printed = await this.localTime.printEntries(entries, payload)
      return { ...printed, results: [...printed.results, ...results.filter(item => !item.ok)], documentStorage: 'local-derived' }
    }

    return results
  }
}

module.exports = { RhSourceService }
