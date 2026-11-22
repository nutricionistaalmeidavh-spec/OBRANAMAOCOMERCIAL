const fs=require('node:fs')
const path=require('node:path')
const {createHash,randomUUID}=require('node:crypto')
const TYPES=new Set(['application/pdf','image/jpeg','image/png'])
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA=/^[a-f0-9]{64}$/
const LINK_TYPES=new Set(['rdos','medicoes','contratos_obra','pedidos_compra','recebimentos_materiais'])
const LINK_FIELDS={rdos:'rdo_id',medicoes:'medicao_id',contratos_obra:'contrato_id',pedidos_compra:'pedido_compra_id',recebimentos_materiais:'recebimento_material_id'}
const invalid=message=>{const error=new Error(message);error.code='invalid_web_p0_command';throw error}
const allowed=(raw,keys)=>{for(const key of Object.keys(raw))if(!keys.includes(key))invalid('Campo documental proibido: '+key)}
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const id=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0
function inspect({repository,scope,command}){
 const companyId=Number(scope?.companyId),workId=Number(scope?.workId)
 if(!id(companyId)||!id(workId)||command?.action!=='create'&&command?.action!==undefined||
     !UUID.test(String(command?.id||''))||command?.deviceId!==scope?.deviceId)invalid('Comando documental não autorizado.')
 const company=repository.get('empresas',companyId),work=repository.get('obras',workId)
 if(!company||company.deleted_at||!work||work.deleted_at||Number(work.empresa_id)!==companyId)invalid('Empresa/obra documental incompatíveis.')
 const data=record(command.data)
 allowed(data,['stageId','sha256','name','mimeType','categoria','titulo','relacao_tipo','relacao_id'])
 if(!UUID.test(String(data.stageId||''))||command.id!==data.stageId||!SHA.test(String(data.sha256||''))||
    typeof data.name!=='string'||data.name.length<1||data.name.length>120||/[\\/\x00-\x1f]/.test(data.name)||
    !TYPES.has(data.mimeType)||!/^[a-zA-Z0-9_-]{2,50}$/.test(String(data.categoria||''))||
    data.titulo!==undefined&&(typeof data.titulo!=='string'||!data.titulo.trim()||data.titulo.length>250))
   invalid('Dados documentais inválidos.')
 if((data.relacao_tipo===undefined)!==(data.relacao_id===undefined))invalid('Vínculo incompleto.')
 if(data.relacao_tipo!==undefined){
  if(!LINK_TYPES.has(data.relacao_tipo)||!id(data.relacao_id))invalid('Vínculo documental inválido.')
  const related=repository.get(data.relacao_tipo,data.relacao_id)
  if(!related||related.deleted_at||Number(related.obra_id)!==workId)invalid('Documento não pertence ao registro da obra.')
 }
 const fingerprint=createHash('sha256').update(JSON.stringify({entity:'documentos',data,companyId,workId,deviceId:scope.deviceId})).digest('hex')
 return{data,companyId,workId,fingerprint,document:{empresa_id:companyId,obra_id:workId,
  categoria:data.categoria,titulo:data.titulo||data.name,status_assinatura:'geral',versao:1,
  ...(data.relacao_tipo?{[LINK_FIELDS[data.relacao_tipo]]:data.relacao_id}:{})}}
}
function bytesFor(command,expected){
 const staged=record(command.stagedFile)
 if(staged.sha256!==expected.sha256||staged.name!==expected.name||staged.mimeType!==expected.mimeType||
     typeof staged.data!=='string'||!staged.data||staged.data.length>Math.ceil(2*1024*1024/3)*4+8||
     !/^[a-zA-Z0-9+/]+={0,2}$/.test(staged.data))invalid('Arquivo documental não verificado.')
 const bytes=Buffer.from(staged.data,'base64')
 if(bytes.length<5||bytes.length>2*1024*1024)invalid('Arquivo documental excede 2 MB.')
 const actual=createHash('sha256').update(bytes).digest('hex')
 if(actual!==expected.sha256)invalid('Falha na verificação SHA256 do documento.')
 const mime=staged.mimeType
 if((mime==='application/pdf'&&bytes.subarray(0,5).toString('ascii')!=='%PDF-')||
    (mime==='image/jpeg'&&!(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff))||
    (mime==='image/png'&&![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)))invalid('Conteúdo não corresponde ao MIME declarado.')
 return bytes
}
function replay(db,scope,command,fingerprint){
 const row=db.prepare('SELECT * FROM web_p0_command_receipts WHERE command_id=?').get(command.id)
 if(!row)return null
 if(row.payload_hash!==fingerprint||Number(row.empresa_id)!==Number(scope.companyId)||
   Number(row.obra_id)!==Number(scope.workId)||row.device_id!==scope.deviceId||row.entity!=='documentos')
     invalid('Identificador documental já usado por outro comando.')
 return{entity:'documentos',action:'create',localId:row.local_id,duplicate:true}
}
function receipt(db,scope,command,localId,fingerprint){
 db.prepare('INSERT INTO web_p0_command_receipts(command_id,device_id,empresa_id,obra_id,entity,payload_hash,local_id) VALUES(?,?,?,?,?,?,?)')
 .run(command.id,scope.deviceId,scope.companyId,scope.workId,'documentos',fingerprint,localId)
}

function applyLocalP1Document({database,scope,command,documentsDir}){
 if(!database?.db||!documentsDir)invalid('Diretório documental local indisponível.')
 const {data,workId,fingerprint,document}=inspect({repository:database,scope,command})
 const db=database.db,old=replay(db,scope,command,fingerprint)
 if(old)return old
 const bytes=bytesFor(command,data)
 const destDir=path.resolve(documentsDir)
 fs.mkdirSync(destDir,{recursive:true})
 const extension=data.mimeType==='application/pdf'?'.pdf':data.mimeType==='image/png'?'.png':'.jpg'
 const filename=randomUUID()+extension,target=path.join(destDir,filename)
 fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600})
 try{
  return db.transaction(()=>{
   const raced=replay(db,scope,command,fingerprint)
   if(raced){fs.unlinkSync(target);return raced}
   const file=database.save('arquivos',{nome_original:data.name,nome_armazenado:filename,
     caminho:target,tamanho:bytes.length,extensao:extension,mime_type:data.mimeType,hash:data.sha256,origem:'web_p1'})
   const saved=database.save('documentos',{...document,arquivo_id:file.id})
   if(data.relacao_tipo==='rdos')database.save('rdo_anexos',{rdo_id:data.relacao_id,documento_id:saved.id,legenda:document.titulo})
   if(data.relacao_tipo==='medicoes')database.save('medicao_anexos',{medicao_id:data.relacao_id,documento_id:saved.id,tipo:'comprovante'})
   if(data.relacao_tipo==='contratos_obra')database.save('contrato_anexos',{contrato_id:data.relacao_id,documento_id:saved.id,tipo:'contrato'})
   if(data.relacao_tipo==='pedidos_compra')database.save('pedido_compra_anexos',{pedido_compra_id:data.relacao_id,documento_id:saved.id,tipo:'nota'})
   receipt(db,scope,command,saved.id,fingerprint)
   return{entity:'documentos',action:'create',localId:saved.id,duplicate:false}
  })()
 }catch(error){try{fs.unlinkSync(target)}catch{}throw error}
}
module.exports={applyLocalP1Document}
