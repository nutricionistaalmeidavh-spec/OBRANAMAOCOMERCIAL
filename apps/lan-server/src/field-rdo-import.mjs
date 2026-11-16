import { createHash } from 'node:crypto'
import { RdoMaterialConsumption } from './rdo-material-consumption.mjs'

const digest=value=>createHash('sha256').update(value).digest('hex')
const clean=value=>String(value??'').trim()
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const list=value=>Array.isArray(value)?value:[]
function validatePhotos(rows){
 if(!Array.isArray(rows)||rows.length>60)throw new Error('Lista de evidências fotográficas inválida.')
 const ids=new Set()
 return rows.map(raw=>{
  const p=record(raw),id=clean(p.id).toLowerCase(),mime=clean(p.contentType),sha256=clean(p.sha256).toLowerCase(),base64=clean(p.data)
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)||ids.has(id))
   throw new Error('Identificador duplicado ou inválido de evidência fotográfica.')
  if(!['image/jpeg','image/png','image/webp'].includes(mime)||!/^[0-9a-f]{64}$/.test(sha256))
   throw new Error('Tipo ou hash de evidência inválido.')
  if(!base64||base64.length>668000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
   throw new Error('Dados da foto ausentes ou acima do limite de 500 KB.')
  const bytes=Buffer.from(base64,'base64')
  if(!bytes.length||bytes.length>500000||bytes.toString('base64')!==base64)
   throw new Error('Conteúdo codificado da foto inválido.')
  const actual=bytes.length>2&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':
   bytes.length>=8&&Buffer.from([137,80,78,71,13,10,26,10]).equals(bytes.subarray(0,8))?'image/png':
   bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null
  if(actual!==mime||digest(bytes)!==sha256)throw new Error('Hash ou formato de evidência fotográfica incorreto.')
  ids.add(id)
  return{id,mime,sha256,bytes,uploadedAt:clean(p.uploadedAt)||null}
 })
}

function buildReport(report){
  const day=record(report.report)
  const activities=list(day.sessions).filter(s=>s&&typeof s==='object').slice(0,200)
    .map(s=>`${clean(s.service)||'Serviço'}${Number.isFinite(Number(s.floor))?' · pav. '+Number(s.floor):''} · ${clean(s.result||s.state)||'apontamento'}`).join('\n').slice(0,20000)
  const notes=[clean(day.note),...list(day.events).slice(0,100).map(e=>clean(record(e).label)).filter(Boolean)]
    .filter(Boolean).join('\n').slice(0,20000)
  return {activities,notes}
}
const contentHash=rdo=>digest(JSON.stringify({
  obra_id:Number(rdo.obra_id),data:String(rdo.data),clima:String(rdo.clima||''),
  status:String(rdo.status||''),atividades:String(rdo.atividades||''),observacoes:String(rdo.observacoes||'')
}))

export class FieldRdoImport {
  constructor({repository}){
    if(!repository?.connection||!repository?.save||!repository?.get)throw new Error('Repositório canônico inválido.')
    this.repository=repository
    this.db=repository.connection()
    this.materials=new RdoMaterialConsumption({repository})
  }
  apply(input={}){
    const scope=record(input.scope),report=record(input.report),day=record(report.report)
    const remoteProjectId=clean(scope.remoteProjectId)
    const date=clean(report.date),fingerprint=String(report.fingerprint||'')
    const companyId=Number(scope.companyId),workId=Number(scope.workId)
    if(!remoteProjectId||remoteProjectId.length>180||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!fingerprint||fingerprint.length>128000)
      throw new Error('Escopo ou data de RDO mobile inválidos.')
    if(day.date!==date||day.materialsReviewed!==true)throw new Error('Consumo do RDO não foi conferido na PWA.')
    const work=this.repository.get('obras',workId)
    if(!work||work.deleted_at||Number(work.empresa_id)!==companyId)throw new Error('Obra não pertence à empresa autorizada.')
    const oldLink=this.db.prepare('SELECT * FROM field_rdo_links WHERE remote_project_id=? AND day=?').get(remoteProjectId,date)
    const photos=validatePhotos(list(day.photos))
    const fields=buildReport(report)
    let rdo
    if(oldLink){
      rdo=this.repository.get('rdos',Number(oldLink.rdo_id))
      if(!rdo||rdo.deleted_at||Number(rdo.obra_id)!==workId||rdo.data!==date)throw new Error('Vínculo do RDO canônico inconsistente.')
      if(oldLink.last_fingerprint===fingerprint){
        const stored=this.db.prepare('SELECT photo_id,sha256 FROM field_rdo_evidencias WHERE rdo_id=? AND active=1').all(rdo.id)
        if(stored.length!==photos.length||photos.some(p=>!stored.some(s=>s.photo_id===p.id&&s.sha256===p.sha256)))
         throw new Error('Evidência canônica alterada ou ausente: nova conferência necessária.')
        const materials=this.materials.list(rdo.id)
        return {localRdoId:rdo.id,materialRevision:materials.revision,replayed:true}
      }
      if(oldLink.last_rdo_hash&&oldLink.last_rdo_hash!==contentHash(rdo))throw new Error('O RDO foi alterado no Desktop após a última integração. Revise antes de importar novamente.')
      if(['fechado','finalizado'].includes(rdo.status))throw new Error('Reabra o RDO canônico antes de atualizar o consumo.')
      rdo=this.repository.save('rdos',{id:rdo.id,atividades:fields.activities,observacoes:fields.notes})
      this.db.prepare('UPDATE field_rdo_links SET last_rdo_hash=? WHERE remote_project_id=? AND day=?').run(contentHash(rdo),remoteProjectId,date)
    }else{
      const existing=this.db.prepare('SELECT id FROM rdos WHERE obra_id=? AND data=? AND deleted_at IS NULL').get(workId,date)
      if(existing)throw new Error('Já existe RDO manual nesta obra e data. Vincule-o após conferência para evitar duplicações.')
      rdo=this.repository.save('rdos',{obra_id:workId,frente_id:null,data:date,clima:null,status:'rascunho',atividades:fields.activities,observacoes:fields.notes})
      this.db.prepare('INSERT INTO field_rdo_links(remote_project_id,day,rdo_id,last_rdo_hash) VALUES(?,?,?,?)')
        .run(remoteProjectId,date,rdo.id,contentHash(rdo))
    }
    // The RDO identity is durable before stock application. On an interruption
    // the retry reuses this identity and the idempotent materials operation.
    const requestId='field-rdo:'+digest(remoteProjectId+'|'+date+'|'+fingerprint).slice(0,64)
    const oldRevision=this.materials.list(rdo.id).revision
    const materialReceipt=this.materials.save({rdoId:rdo.id,requestId,expectedRevision:oldRevision,items:list(day.materials)})
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare('UPDATE field_rdo_evidencias SET active=0 WHERE rdo_id=?').run(rdo.id)
      const write=this.db.prepare(`INSERT INTO field_rdo_evidencias
        (rdo_id,photo_id,mime_type,sha256,bytes,uploaded_at,active) VALUES(?,?,?,?,?,?,1)
        ON CONFLICT(rdo_id,photo_id) DO UPDATE SET
         mime_type=excluded.mime_type,sha256=excluded.sha256,bytes=excluded.bytes,
         uploaded_at=excluded.uploaded_at,active=1`)
      for(const p of photos)write.run(rdo.id,p.id,p.mime,p.sha256,p.bytes,p.uploadedAt)
      this.db.prepare(`UPDATE field_rdo_links SET last_fingerprint=?,last_rdo_hash=?,
      last_material_revision=?,updated_at=CURRENT_TIMESTAMP
      WHERE remote_project_id=? AND day=?`)
      .run(fingerprint,contentHash(rdo),materialReceipt.revision,remoteProjectId,date)
      this.db.exec('COMMIT')
    } catch(error) {
      try{this.db.exec('ROLLBACK')}catch{}
      throw error
    }
    return {localRdoId:rdo.id,materialRevision:materialReceipt.revision,replayed:false}
  }
}
