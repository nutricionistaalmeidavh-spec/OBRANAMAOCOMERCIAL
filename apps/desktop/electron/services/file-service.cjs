const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { shell, clipboard, dialog } = require('electron')

const INVALID = /[<>:"/\\|?*\x00-\x1F]/g
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

function sanitizeName(value, fallback = 'Sem nome') {
  let name = String(value || fallback).replace(INVALID, '-').replace(/[. ]+$/g, '').trim().slice(0, 80)
  if (!name || RESERVED.test(name)) name = `${fallback}-${Date.now()}`
  return name
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

class FileService {
  constructor({ documentsDir, db, dataAccess = null, lanClient = null, moduleStorage = null, storage = null }) {
    this.documentsDir = documentsDir
    this.db = db
    this.dataAccess = dataAccess
    this.lanClient = lanClient
    this.moduleStorage = moduleStorage
    this.storage = storage
    fs.mkdirSync(documentsDir, { recursive: true })
  }

  documentRoute() {
    const state=this.storage?.state?.()
    if(!state||state.mode!=='server')return 'local'
    if(this.moduleStorage?.state?.('documents')?.state==='central-active')return 'remote'
    throw new Error('Documentos centrais ainda não estão ativos; nenhum arquivo será salvo localmente como fallback.')
  }

  centralFileId(value) {
    const match=String(value||'').match(/^server:\/\/file\/(\d+)$/)
    return match ? Number(match[1]) : null
  }

  async chooseSource(title) {
    const result=await dialog.showOpenDialog({ properties:['openFile'], title })
    if(result.canceled||!result.filePaths[0])return null
    return result.filePaths[0]
  }

  centralFilePayload(source) {
    const stat=fs.statSync(source)
    if(!stat.isFile())throw new Error('Arquivo selecionado é inválido.')
    if(stat.size>25*1024*1024)throw new Error('O arquivo excede 25 MB, limite do servidor local.')
    return { name:path.basename(source), mimeType:null, contentBase64:fs.readFileSync(source).toString('base64') }
  }

  async materializeCentral(fileId) {
    if(!this.dataAccess||!this.lanClient)throw new Error('Cliente documental central indisponível.')
    const meta=await this.dataAccess.get('arquivos',Number(fileId))
    if(!meta)throw new Error('Arquivo central não encontrado.')
    const bytes=await this.lanClient.downloadFile(Number(fileId))
    const cacheDir=path.join(this.documentsDir,'.server-cache')
    fs.mkdirSync(cacheDir,{recursive:true})
    const extension=path.extname(String(meta.nome_original||''))||String(meta.extensao||'')
    const base=sanitizeName(path.basename(String(meta.nome_original||`arquivo-${fileId}`),extension),`arquivo-${fileId}`)
    const destination=path.join(cacheDir,`${fileId}-${base}${extension}`)
    fs.writeFileSync(destination,bytes)
    return destination
  }

  employeeFolders(employee, companyName = 'Empresa') {
    const base = path.join(this.documentsDir, sanitizeName(companyName), 'Funcionários', sanitizeName(`${employee.nome} - ${employee.cpf || employee.id}`))
    const folders = {
      base,
      unsigned: path.join(base, 'Não assinados'),
      signed: path.join(base, 'Assinados'),
      general: path.join(base, 'Documentação Geral')
    }
    Object.values(folders).forEach((folder) => fs.mkdirSync(folder, { recursive: true }))
    return folders
  }

  async importForEmployee({ funcionario_id, categoria, status_assinatura = 'geral', documento_origem_id, title }) {
    if(this.documentRoute()==='remote'){
      if(!this.dataAccess||!this.lanClient)throw new Error('Storage documental central indisponível.')
      const employee=await this.dataAccess.get('funcionarios',funcionario_id)
      if(!employee)throw new Error('Funcionário não encontrado.')
      const source=await this.chooseSource('Selecionar documento')
      if(!source)return null
      const result=await this.lanClient.uploadDocument({
        file:this.centralFilePayload(source),
        document:{empresa_id:employee.empresa_id,obra_id:employee.obra_atual_id||null,funcionario_id:employee.id,categoria,titulo:title||path.basename(source),status_assinatura,documento_origem_id:documento_origem_id||null,versao:1}
      })
      return result?.document||result
    }
    const employee = this.db.get('funcionarios', funcionario_id)
    if (!employee) throw new Error('Funcionário não encontrado.')
    const company = employee.empresa_id ? this.db.get('empresas', employee.empresa_id) : null
    const result = await dialog.showOpenDialog({ properties: ['openFile'], title: 'Selecionar documento' })
    if (result.canceled || !result.filePaths[0]) return null
    const source = result.filePaths[0]
    const folderSet = this.employeeFolders(employee, company?.nome_fantasia || company?.razao_social)
    const folder = status_assinatura === 'assinado' ? folderSet.signed : folderSet.general
    const extension = path.extname(source)
    const storedName = `${sanitizeName(path.basename(source, extension))}-${Date.now()}${extension.toLowerCase()}`
    const destination = path.join(folder, storedName)
    if (destination.length > 245) throw new Error('O caminho final do arquivo é muito longo para o Windows.')
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
    const stat = fs.statSync(destination)
    const arquivo = this.db.save('arquivos', {
      nome_original: path.basename(source), nome_armazenado: storedName, caminho: destination,
      tamanho: stat.size, extensao: extension.toLowerCase(), mime_type: null, hash: sha256(destination), origem: 'importado'
    })
    return this.db.save('documentos', {
      arquivo_id: arquivo.id, empresa_id: employee.empresa_id, obra_id: employee.obra_atual_id,
      funcionario_id: employee.id, categoria, titulo: title || path.basename(source), status_assinatura,
      documento_origem_id: documento_origem_id || null, versao: 1
    })
  }

  async importForMeasurement({ medicao_id, tipo = 'comprovante', title }) {
    if(this.documentRoute()==='remote'){
      if(!this.dataAccess||!this.lanClient)throw new Error('Storage documental central indisponível.')
      const measurement=await this.dataAccess.get('medicoes',medicao_id)
      if(!measurement)throw new Error('Medição não encontrada.')
      const work=await this.dataAccess.get('obras',measurement.obra_id)
      if(!work)throw new Error('Obra não encontrada.')
      const source=await this.chooseSource('Selecionar anexo da medição')
      if(!source)return null
      const result=await this.lanClient.uploadDocument({
        file:this.centralFilePayload(source),
        document:{empresa_id:work.empresa_id,obra_id:measurement.obra_id,frente_id:measurement.frente_id||null,medicao_id:measurement.id,categoria:'medicao',titulo:title||`Medição ${measurement.numero}: ${path.basename(source)}`,status_assinatura:'geral',versao:1,tipo}
      })
      return result?.document||result
    }
    const measurement = this.db.get('medicoes', medicao_id)
    if (!measurement) throw new Error('Medição não encontrada.')
    const work = this.db.get('obras', measurement.obra_id)
    const result = await dialog.showOpenDialog({ properties: ['openFile'], title: 'Selecionar anexo da medição' })
    if (result.canceled || !result.filePaths[0]) return null
    const source = result.filePaths[0]
    const extension = path.extname(source)
    const folder = path.join(this.documentsDir, 'Obras', sanitizeName(work?.nome || `Obra ${measurement.obra_id}`), 'Medições', sanitizeName(measurement.numero))
    fs.mkdirSync(folder, { recursive: true })
    const storedName = `${sanitizeName(path.basename(source, extension))}-${Date.now()}${extension.toLowerCase()}`
    const destination = path.join(folder, storedName)
    if (destination.length > 245) throw new Error('O caminho final do arquivo é muito longo para o Windows.')
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
    const stat = fs.statSync(destination)
    const arquivo = this.db.save('arquivos', { nome_original: path.basename(source), nome_armazenado: storedName, caminho: destination, tamanho: stat.size, extensao: extension.toLowerCase(), mime_type: null, hash: sha256(destination), origem: 'importado' })
    const document = this.db.save('documentos', { arquivo_id: arquivo.id, empresa_id: work?.empresa_id, obra_id: measurement.obra_id, categoria: 'medicao', titulo: title || `Medição ${measurement.numero}: ${path.basename(source)}`, status_assinatura: 'geral', versao: 1 })
    return this.db.save('medicao_anexos', { medicao_id: measurement.id, documento_id: document.id, tipo })
  }

  async importForWorkDocument({ obra_id, frente_id = null, categoria = 'documento_obra', title, rdo_id = null, contrato_id = null, contrato_aditivo_id = null, pedido_compra_id = null, recebimento_material_id = null, tipo = 'anexo' }) {
    if(this.documentRoute()==='remote'){
      if(!this.dataAccess||!this.lanClient)throw new Error('Storage documental central indisponível.')
      const work=await this.dataAccess.get('obras',obra_id)
      if(!work)throw new Error('Obra nao encontrada.')
      const source=await this.chooseSource('Selecionar documento da obra')
      if(!source)return null
      const result=await this.lanClient.uploadDocument({
        file:this.centralFilePayload(source),
        document:{empresa_id:work.empresa_id,obra_id:work.id,frente_id:frente_id||null,rdo_id:rdo_id||null,contrato_id:contrato_id||null,contrato_aditivo_id:contrato_aditivo_id||null,pedido_compra_id:pedido_compra_id||null,recebimento_material_id:recebimento_material_id||null,categoria,titulo:title||path.basename(source),status_assinatura:'geral',versao:1,tipo}
      })
      return result?.document||result
    }
    const work = this.db.get('obras', obra_id)
    if (!work) throw new Error('Obra nao encontrada.')
    const result = await dialog.showOpenDialog({ properties: ['openFile'], title: 'Selecionar documento da obra' })
    if (result.canceled || !result.filePaths[0]) return null
    const source = result.filePaths[0]
    const extension = path.extname(source)
    const folder = path.join(this.documentsDir, 'Obras', sanitizeName(work.nome || `Obra ${work.id}`), sanitizeName(categoria))
    fs.mkdirSync(folder, { recursive: true })
    const storedName = `${sanitizeName(path.basename(source, extension))}-${Date.now()}${extension.toLowerCase()}`
    const destination = path.join(folder, storedName)
    if (destination.length > 245) throw new Error('O caminho final do arquivo e muito longo para o Windows.')
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
    const stat = fs.statSync(destination)
    const arquivo = this.db.save('arquivos', {
      nome_original: path.basename(source),
      nome_armazenado: storedName,
      caminho: destination,
      tamanho: stat.size,
      extensao: extension.toLowerCase(),
      mime_type: null,
      hash: sha256(destination),
      origem: 'importado'
    })
    const document = this.db.save('documentos', {
      arquivo_id: arquivo.id,
      empresa_id: work.empresa_id,
      obra_id: work.id,
      frente_id: frente_id || null,
      rdo_id: rdo_id || null,
      contrato_id: contrato_id || null,
      contrato_aditivo_id: contrato_aditivo_id || null,
      pedido_compra_id: pedido_compra_id || null,
      recebimento_material_id: recebimento_material_id || null,
      categoria,
      titulo: title || path.basename(source),
      status_assinatura: 'geral',
      versao: 1
    })
    if (rdo_id) this.db.save('rdo_anexos', { rdo_id, documento_id: document.id, frente_id: frente_id || null, legenda: title || null })
    if (contrato_id) this.db.save('contrato_anexos', { contrato_id, documento_id: document.id, tipo })
    if (pedido_compra_id) this.db.save('pedido_compra_anexos', { pedido_compra_id, documento_id: document.id, tipo })
    return document
  }

  async open(filePath) {
    const fileId=this.centralFileId(filePath)
    if(fileId){const local=await this.materializeCentral(fileId);return shell.openPath(local)}
    this.assertManagedPath(filePath); return shell.openPath(filePath)
  }
  async reveal(filePath) {
    const fileId=this.centralFileId(filePath)
    if(fileId){const local=await this.materializeCentral(fileId);shell.showItemInFolder(local);return true}
    this.assertManagedPath(filePath); shell.showItemInFolder(filePath); return true
  }
  copyPath(filePath) {
    const fileId=this.centralFileId(filePath)
    if(fileId){clipboard.writeText(`server://file/${fileId}`);return true}
    this.assertManagedPath(filePath); clipboard.writeText(filePath); return true
  }
  openDocumentsFolder() { return shell.openPath(this.documentsDir) }
  assertManagedPath(filePath) {
    if (!filePath || typeof filePath !== 'string') throw new Error('Arquivo ou pasta indisponível.')
    const root = path.resolve(this.documentsDir)
    const target = path.resolve(filePath)
    const relative = path.relative(root, target)
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative) || !fs.existsSync(target)) {
      throw new Error('Arquivo ou pasta fora da área gerenciada.')
    }
  }

  async deleteDocument({ id, deletePhysical = false }) {
    if(this.documentRoute()==='remote'){
      if(!this.lanClient)throw new Error('Storage documental central indisponível.')
      await this.lanClient.deleteDocument(Number(id))
      return true
    }
    const document = this.db.get('documentos', id)
    if (!document) return true
    const file = document.arquivo_id ? this.db.get('arquivos', document.arquivo_id) : null
    this.db.db.transaction(() => {
      this.db.remove('documentos', id)
      if (deletePhysical && file && fs.existsSync(file.caminho)) fs.unlinkSync(file.caminho)
    })()
    return true
  }
}

module.exports = { FileService, sanitizeName, sha256 }
