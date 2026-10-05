import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const SERVER_URI=/^server:\/\/file\/([a-zA-Z0-9._-]+)$/
const safeName=value=>String(value||'arquivo').replace(/[<>:"/\\|?*\x00-\x1F]/g,'-').replace(/[. ]+$/g,'').slice(0,120)||'arquivo'
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex')

export class DocumentStorageService {
  constructor({repository,filesDir,maxBytes=25*1024*1024}={}){
    if(!repository?.connection||!repository?.save)throw new Error('Repositório documental central indisponível.')
    if(!filesDir)throw new Error('Diretório documental central não informado.')
    this.repository=repository;this.filesDir=path.resolve(filesDir);this.maxBytes=maxBytes
    fs.mkdirSync(this.filesDir,{recursive:true})
  }
  get db(){return this.repository.connection()}
  bytes(contentBase64){
    if(typeof contentBase64!=='string'||!contentBase64)throw new Error('Conteúdo do arquivo não informado.')
    const value=Buffer.from(contentBase64,'base64')
    if(!value.length)throw new Error('Arquivo vazio não pode ser armazenado.')
    if(value.length>this.maxBytes)throw new Error('Arquivo excede o limite de 25 MB do servidor local.')
    return value
  }
  assertWork(document){
    const companyId=Number(document?.empresa_id),workId=Number(document?.obra_id)
    if(!Number.isSafeInteger(companyId)||companyId<=0)throw new Error('Empresa do documento não informada.')
    if(workId){
      const work=this.repository.get('obras',workId)
      if(!work||work.deleted_at||Number(work.empresa_id)!==companyId)throw new Error('Obra do documento deve pertencer à mesma empresa.')
    }
    const check=(table,id,label,workField='obra_id')=>{
      if(id===null||id===undefined||id==='')return
      const row=this.repository.get(table,Number(id))
      if(!row||row.deleted_at)throw new Error(`${label} do documento não encontrado.`)
      if(workId&&row[workField]!==undefined&&Number(row[workField])!==workId)throw new Error(`${label} deve pertencer à mesma obra.`)
    }
    check('frentes_obra',document.frente_id,'Frente')
    check('rdos',document.rdo_id,'RDO')
    check('medicoes',document.medicao_id,'Medição')
    check('contratos_obra',document.contrato_id,'Contrato')
    check('pedidos_compra',document.pedido_compra_id,'Pedido de compra')
    return true
  }
  storeFileRecord(data,contentBase64){
    const bytes=this.bytes(contentBase64)
    const extension=String(data?.extensao||path.extname(String(data?.nome_original||''))||'').toLowerCase().slice(0,20)
    const storageName=`${randomUUID()}${extension}`
    const destination=path.join(this.filesDir,storageName)
    fs.writeFileSync(destination,bytes,{flag:'wx'})
    try{
      let saved=this.repository.save('arquivos',{
        nome_original:safeName(data?.nome_original||storageName),
        nome_armazenado:storageName,
        caminho:`pending://${storageName}`,
        tamanho:bytes.length,
        extensao:extension||null,
        mime_type:data?.mime_type||null,
        hash:sha256(bytes),
        origem:data?.origem||'importado'
      })
      saved=this.repository.save('arquivos',{...saved,id:saved.id,caminho:`server://file/${saved.id}`})
      return saved
    }catch(error){try{fs.unlinkSync(destination)}catch{};throw error}
  }
  store({file,document}={}){
    this.assertWork(document||{})
    const bytes=this.bytes(file?.contentBase64)
    const extension=String(path.extname(String(file?.name||''))||'').toLowerCase().slice(0,20)
    const storageName=`${randomUUID()}${extension}`
    const destination=path.join(this.filesDir,storageName)
    fs.writeFileSync(destination,bytes,{flag:'wx'})
    this.db.exec('BEGIN IMMEDIATE')
    try{
      let savedFile=this.repository.save('arquivos',{
        nome_original:safeName(file?.name||storageName),nome_armazenado:storageName,caminho:`pending://${storageName}`,
        tamanho:bytes.length,extensao:extension||null,mime_type:file?.mimeType||null,hash:sha256(bytes),origem:file?.origin||'importado'
      })
      savedFile=this.repository.save('arquivos',{...savedFile,id:savedFile.id,caminho:`server://file/${savedFile.id}`})
      const savedDocument=this.repository.save('documentos',{...(document||{}),arquivo_id:savedFile.id})
      if(document?.rdo_id)this.repository.save('rdo_anexos',{rdo_id:Number(document.rdo_id),frente_id:document.frente_id||null,documento_id:savedDocument.id,legenda:document.titulo||null})
      if(document?.medicao_id)this.repository.save('medicao_anexos',{medicao_id:Number(document.medicao_id),documento_id:savedDocument.id,tipo:document.tipo||'comprovante'})
      if(document?.contrato_id)this.repository.save('contrato_anexos',{contrato_id:Number(document.contrato_id),documento_id:savedDocument.id,tipo:document.tipo||'contrato'})
      if(document?.pedido_compra_id)this.repository.save('pedido_compra_anexos',{pedido_compra_id:Number(document.pedido_compra_id),documento_id:savedDocument.id,tipo:document.tipo||'nota'})
      this.db.exec('COMMIT')
      return{file:savedFile,document:savedDocument}
    }catch(error){try{this.db.exec('ROLLBACK')}catch{};try{fs.unlinkSync(destination)}catch{};throw error}
  }
  pathFor(file){
    const stored=String(file?.nome_armazenado||'')
    if(!stored||stored!==path.basename(stored))throw new Error('Arquivo central inválido.')
    const target=path.resolve(this.filesDir,stored)
    if(path.dirname(target)!==this.filesDir||!fs.existsSync(target))throw new Error('Arquivo central não encontrado.')
    return target
  }
  read(id){
    const file=this.repository.get('arquivos',Number(id))
    if(!file)throw new Error('Arquivo central não encontrado.')
    return{file,bytes:fs.readFileSync(this.pathFor(file))}
  }
  removeFile(id){
    const file=this.repository.get('arquivos',Number(id))
    if(!file)return false
    try{fs.unlinkSync(this.pathFor(file))}catch{}
    return this.repository.remove('arquivos',Number(id))
  }
  deleteDocument(id,{deletePhysical=false}={}){
    const document=this.repository.get('documentos',Number(id))
    if(!document)return true
    const fileId=Number(document.arquivo_id||0)
    this.db.exec('BEGIN IMMEDIATE')
    try{
      for(const [table,column] of [['rdo_anexos','documento_id'],['medicao_anexos','documento_id'],['contrato_anexos','documento_id'],['pedido_compra_anexos','documento_id']]){
        try{this.db.prepare(`DELETE FROM ${table} WHERE ${column}=?`).run(Number(id))}catch{}
      }
      this.repository.remove('documentos',Number(id))
      this.db.exec('COMMIT')
    }catch(error){try{this.db.exec('ROLLBACK')}catch{};throw error}
    if(fileId&&deletePhysical){
      const refs=Number(this.db.prepare('SELECT COUNT(*) n FROM documentos WHERE arquivo_id=? AND deleted_at IS NULL').get(fileId)?.n||0)
      if(!refs)this.removeFile(fileId)
    }
    return true
  }
}

export function fileIdFromServerUri(value){
  const match=String(value||'').match(SERVER_URI)
  return match?match[1]:null
}
