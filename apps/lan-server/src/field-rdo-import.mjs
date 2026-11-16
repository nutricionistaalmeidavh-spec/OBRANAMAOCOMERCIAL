import { createHash } from 'node:crypto'
import { RdoMaterialConsumption } from './rdo-material-consumption.mjs'

const digest=value=>createHash('sha256').update(String(value)).digest('hex')
const clean=value=>String(value??'').trim()
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const list=value=>Array.isArray(value)?value:[]

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
    const fields=buildReport(report)
    let rdo
    if(oldLink){
      rdo=this.repository.get('rdos',Number(oldLink.rdo_id))
      if(!rdo||rdo.deleted_at||Number(rdo.obra_id)!==workId||rdo.data!==date)throw new Error('Vínculo do RDO canônico inconsistente.')
      if(oldLink.last_fingerprint===fingerprint){
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
    this.db.prepare(`UPDATE field_rdo_links SET last_fingerprint=?,last_rdo_hash=?,
      last_material_revision=?,updated_at=CURRENT_TIMESTAMP
      WHERE remote_project_id=? AND day=?`)
      .run(fingerprint,contentHash(rdo),materialReceipt.revision,remoteProjectId,date)
    return {localRdoId:rdo.id,materialRevision:materialReceipt.revision,replayed:false}
  }
}
