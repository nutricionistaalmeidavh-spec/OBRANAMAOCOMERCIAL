const fs = require('node:fs')
const path = require('node:path')

class FileSourceService {
  constructor({ local, dataAccess, lanClient, moduleStorage, dialog, shell, clipboard, cacheDir }) {
    this.local = local
    this.dataAccess = dataAccess
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.dialog = dialog
    this.shell = shell
    this.clipboard = clipboard
    this.cacheDir = path.resolve(cacheDir)
    fs.mkdirSync(this.cacheDir, { recursive:true })
  }

  get documentsDir() { return this.local.documentsDir }
  set documentsDir(value) { this.local.documentsDir = value }

  employeeFolders(...args) { return this.local.employeeFolders(...args) }

  route() {
    const state = this.moduleStorage?.state?.('rh')?.state || 'local'
    if (state === 'central-active') return 'central'
    if (state === 'central-ready') return 'blocked'
    return 'local'
  }

  blocked() {
    throw new Error('Documentos compartilhados ainda não estão ativos no servidor; nenhum arquivo será salvo localmente como fallback.')
  }

  async choose(title) {
    if (!this.dialog?.showOpenDialog) throw new Error('Seleção de arquivos indisponível.')
    const result = await this.dialog.showOpenDialog({ properties:['openFile'], title })
    if (result.canceled || !result.filePaths?.[0]) return null
    return result.filePaths[0]
  }

  async centralUpload(sourcePath, document, link = null, origin = 'importado') {
    let file = null
    try {
      file = await this.lanClient.uploadFile(sourcePath, { origin })
      const savedDocument = await this.dataAccess.save('documentos', {
        ...document,
        arquivo_id:file.id,
        versao:Number(document.versao || 1),
        status_assinatura:document.status_assinatura || 'geral'
      })
      if (link?.kind === 'measurement') {
        await this.dataAccess.save('medicao_anexos', { medicao_id:Number(link.id), documento_id:savedDocument.id, tipo:link.tipo || 'comprovante' })
      } else if (link?.kind === 'rdo') {
        await this.dataAccess.save('rdo_anexos', { rdo_id:Number(link.id), documento_id:savedDocument.id, frente_id:document.frente_id || null, legenda:link.legenda || document.titulo || null })
      } else if (link?.kind === 'contract') {
        await this.dataAccess.save('contrato_anexos', { contrato_id:Number(link.id), documento_id:savedDocument.id, tipo:link.tipo || 'contrato' })
      } else if (link?.kind === 'purchase') {
        await this.dataAccess.save('pedido_compra_anexos', { pedido_compra_id:Number(link.id), documento_id:savedDocument.id, tipo:link.tipo || 'nota' })
      }
      return { document:savedDocument, file }
    } catch (error) {
      if (file?.id) {
        try { await this.lanClient.deleteFile(file.id) } catch {}
      }
      throw error
    }
  }

  async importForEmployee(payload) {
    const route = this.route()
    if (route === 'local') return this.local.importForEmployee(payload)
    if (route === 'blocked') return this.blocked()

    const employee = await this.dataAccess.get('funcionarios', Number(payload.funcionario_id))
    if (!employee) throw new Error('Funcionário não encontrado.')
    const source = await this.choose('Selecionar documento')
    if (!source) return null
    const result = await this.centralUpload(source, {
      empresa_id:employee.empresa_id || null,
      obra_id:employee.obra_atual_id || null,
      funcionario_id:employee.id,
      categoria:payload.categoria,
      titulo:payload.title || path.basename(source),
      status_assinatura:payload.status_assinatura || 'geral',
      documento_origem_id:payload.documento_origem_id || null
    })
    return result.document
  }

  async importForMeasurement(payload) {
    const route = this.route()
    if (route === 'local') return this.local.importForMeasurement(payload)
    if (route === 'blocked') return this.blocked()

    const measurement = await this.dataAccess.get('medicoes', Number(payload.medicao_id))
    if (!measurement) throw new Error('Medição não encontrada.')
    const work = await this.dataAccess.get('obras', Number(measurement.obra_id))
    const source = await this.choose('Selecionar anexo da medição')
    if (!source) return null
    const result = await this.centralUpload(source, {
      empresa_id:work?.empresa_id || null,
      obra_id:measurement.obra_id,
      frente_id:measurement.frente_id || null,
      medicao_id:measurement.id,
      categoria:'medicao',
      titulo:payload.title || `Medição ${measurement.numero}: ${path.basename(source)}`
    }, { kind:'measurement', id:measurement.id, tipo:payload.tipo || 'comprovante' })
    return await this.dataAccess.list('medicao_anexos', { medicao_id:measurement.id }).then(rows => rows.find(row => Number(row.documento_id) === Number(result.document.id)) || result.document)
  }

  async importForWorkDocument(payload) {
    const route = this.route()
    if (route === 'local') return this.local.importForWorkDocument(payload)
    if (route === 'blocked') return this.blocked()

    const work = await this.dataAccess.get('obras', Number(payload.obra_id))
    if (!work) throw new Error('Obra nao encontrada.')
    const source = await this.choose('Selecionar documento da obra')
    if (!source) return null
    let link = null
    if (payload.rdo_id) link = { kind:'rdo', id:payload.rdo_id, legenda:payload.title || null }
    else if (payload.contrato_id) link = { kind:'contract', id:payload.contrato_id, tipo:payload.tipo || 'contrato' }
    else if (payload.pedido_compra_id) link = { kind:'purchase', id:payload.pedido_compra_id, tipo:payload.tipo || 'nota' }

    const result = await this.centralUpload(source, {
      empresa_id:work.empresa_id,
      obra_id:work.id,
      frente_id:payload.frente_id || null,
      rdo_id:payload.rdo_id || null,
      contrato_id:payload.contrato_id || null,
      contrato_aditivo_id:payload.contrato_aditivo_id || null,
      pedido_compra_id:payload.pedido_compra_id || null,
      recebimento_material_id:payload.recebimento_material_id || null,
      categoria:payload.categoria || 'documento_obra',
      titulo:payload.title || path.basename(source),
      status_assinatura:'geral'
    }, link)
    return result.document
  }

  async registerGeneratedFile({ sourcePath, document, link = null }) {
    const route = this.route()
    if (route === 'local') return null
    if (route === 'blocked') return this.blocked()
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('Arquivo gerado não foi encontrado para compartilhamento.')
    return this.centralUpload(sourcePath, document, link, 'gerado')
  }

  remoteFileId(filePath) {
    const match = String(filePath || '').match(/^server:\/\/file\/(\d+)$/)
    return match ? Number(match[1]) : null
  }

  async materialize(filePath) {
    const id = this.remoteFileId(filePath)
    if (!id) return String(filePath || '')
    const file = await this.dataAccess.get('arquivos', id)
    if (!file) throw new Error('Arquivo compartilhado não encontrado.')
    const safeName = String(file.nome_original || file.nome_armazenado || `arquivo-${id}`).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    const destination = path.join(this.cacheDir, `${id}-${safeName}`)
    const bytes = await this.lanClient.downloadFile(id)
    fs.writeFileSync(destination, bytes)
    return destination
  }

  async open(filePath) {
    const id = this.remoteFileId(filePath)
    if (!id) return this.local.open(filePath)
    return this.shell.openPath(await this.materialize(filePath))
  }

  async reveal(filePath) {
    const id = this.remoteFileId(filePath)
    if (!id) return this.local.reveal(filePath)
    this.shell.showItemInFolder(await this.materialize(filePath))
    return true
  }

  async copyPath(filePath) {
    const id = this.remoteFileId(filePath)
    if (!id) return this.local.copyPath(filePath)
    this.clipboard.writeText(await this.materialize(filePath))
    return true
  }

  async openDocumentsFolder() {
    if (this.route() !== 'central') return this.local.openDocumentsFolder()
    fs.mkdirSync(this.cacheDir, { recursive:true })
    return this.shell.openPath(this.cacheDir)
  }

  async deleteDocument({ id, deletePhysical = false } = {}) {
    const route = this.route()
    if (route === 'local') return this.local.deleteDocument({ id, deletePhysical })
    if (route === 'blocked') return this.blocked()
    const document = await this.dataAccess.get('documentos', Number(id))
    if (!document) return true
    const fileId = document.arquivo_id ? Number(document.arquivo_id) : null
    await this.dataAccess.remove('documentos', Number(id), document.revision)
    if (deletePhysical && fileId) await this.lanClient.deleteFile(fileId)
    return true
  }
}

module.exports = { FileSourceService }
