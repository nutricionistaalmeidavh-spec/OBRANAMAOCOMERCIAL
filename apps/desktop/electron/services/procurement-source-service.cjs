const { randomUUID: defaultRandomUUID } = require('node:crypto')

class ProcurementSourceService {
  constructor({ local, lanClient, moduleStorage, notes, randomUUID = defaultRandomUUID }) {
    this.local = local
    this.notes = notes
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.randomUUID = randomUUID
    this.pending = new Map()
  }

  state() { return this.moduleStorage.state('finance').state }
  blocked() { throw new Error('Compras/estoque centrais ainda não estão ativos; nenhum dado será salvo localmente como fallback.') }

  key(kind, payload) {
    return kind + ':' + JSON.stringify(payload || {})
  }

  requestId(kind, payload) {
    const key = this.key(kind, payload)
    if (!this.pending.has(key)) this.pending.set(key, this.randomUUID())
    return { key, requestId:this.pending.get(key) }
  }

  async central(kind, payload, fn) {
    const { key, requestId } = this.requestId(kind, payload)
    try {
      const result = await fn(requestId)
      this.pending.delete(key)
      return result
    } catch (error) {
      throw error
    }
  }

  async summary(obraId) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.summary(obraId)
    if (state === 'central-active') return this.lanClient.procurementSummary(obraId)
    return this.blocked()
  }

  async createOrder(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.createOrder(payload)
    if (state !== 'central-active') return this.blocked()
    return this.central('order', payload, requestId => this.lanClient.procurementCreateOrder({ ...payload, requestId }))
  }

  async receiveMaterial(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.receiveMaterial(payload)
    if (state !== 'central-active') return this.blocked()
    return this.central('receive', payload, requestId => this.lanClient.procurementReceiveMaterial({ ...payload, requestId }))
  }

  async moveStock(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.moveStock(payload)
    if (state !== 'central-active') return this.blocked()
    return this.central('stock', payload, requestId => this.lanClient.procurementMoveStock({ ...payload, requestId }))
  }
  async listReceivedNotes(obraId) {
    const state=this.state()
    if (state==='local'||state==='migration-required') return this.notes.list(obraId)
    if (state==='central-active') return this.lanClient.receivedNotesList(obraId)
    return this.blocked()
  }
  async getReceivedNote(id) {
    const state=this.state()
    if (state==='local'||state==='migration-required') return this.notes.read(id)
    if (state==='central-active') return this.lanClient.receivedNotesGet(id)
    return this.blocked()
  }
  async receivedNotesSummary(obraId) {
    const state=this.state()
    if (state==='local'||state==='migration-required') return this.notes.summary(obraId)
    if (state==='central-active') return this.lanClient.receivedNotesSummary(obraId)
    return this.blocked()
  }
  async receivedCostsReport(filters) {
    const state=this.state()
    if(state==='local'||state==='migration-required')return this.notes.report(filters)
    if(state==='central-active')return this.lanClient.receivedNotesReport(filters)
    return this.blocked()
  }
  async receivedCostsOverview(filters){
    const state=this.state()
    if(state==='local'||state==='migration-required')return this.notes.costsOverview(filters)
    if(state==='central-active')return this.lanClient.receivedCostsOverview(filters)
    return this.blocked()
  }
  async unclassifiedAccounts(filters){
    const state=this.state()
    if(state==='local'||state==='migration-required')return this.notes.unclassifiedAccounts(filters)
    if(state==='central-active')return this.lanClient.unclassifiedAccounts(filters)
    return this.blocked()
  }
  async classifyAccounts(payload){
    const state=this.state()
    if(state==='local'||state==='migration-required')return this.notes.assignAccounts(payload)
    if(state==='central-active')return this.lanClient.classifyAccounts(payload)
    return this.blocked()
  }
  async updateReceivedNote(id,payload){
    const state=this.state()
    if(state==='local'||state==='migration-required')return this.notes.update(id,payload)
    if(state==='central-active')return this.lanClient.receivedNotesUpdate(id,payload)
    return this.blocked()
  }
  async receivedNoteHistory(id){
    const state=this.state()
    if(state==='local'||state==='migration-required')return this.notes.history(id)
    if(state==='central-active')return this.lanClient.receivedNoteHistory(id)
    return this.blocked()
  }
  async createReceivedNote(payload) {
    const state=this.state()
    if (state==='local'||state==='migration-required') return this.notes.create(payload)
    if (state!=='central-active') return this.blocked()
    return this.central('received-note',payload,requestId=>this.lanClient.receivedNotesCreate({...payload,requestId}))
  }
  async attachReceivedNote(id,documentId) {
    const state=this.state()
    if (state==='local'||state==='migration-required') return this.notes.attach(id,documentId)
    if (state==='central-active') return this.lanClient.receivedNotesAttach(id,documentId)
    return this.blocked()
  }

}

module.exports = { ProcurementSourceService }
