import { createHash } from 'node:crypto'
import { RdoMaterialConsumption } from './rdo-material-consumption.mjs'

import { FieldRdoCatalog } from './field-rdo-catalog.mjs'

function crewRows(sessions,people) {
  const byId=new Map(people.map(p=>[p.id,p])), minutes=new Map()
  const time=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):null
  for(const session of list(sessions)){
    const events=list(session?.crewEvents).map(e=>({t:time(e.time),ids:[...new Set(list(e.employeeIds).filter(id=>typeof id==='string'&&id.startsWith('rdo_emp_')))]})).sort((a,b)=>a.t-b.t)
    for(const e of events)for(const id of e.ids){if(!byId.has(id))throw new Error('Funcionário do apontamento não pertence à equipe desta obra.');if(!minutes.has(id))minutes.set(id,0)}
    for(const seg of list(session?.segments)){
      const start=time(seg.start),end=time(seg.end)
      if(start===null||end===null||end<=start)continue
      for(let i=0;i<events.length;i++){const e=events[i];if(e.t===null)continue
        const duration=Math.max(0,Math.min(end,events[i+1]?.t??end)-Math.max(start,e.t))
        for(const id of e.ids)minutes.set(id,minutes.get(id)+duration)
      }
    }
  }
  return [...minutes].map(([id,m])=>({...byId.get(id),hours:m/60}))
}

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

// Field keys are transport identifiers; the canonical RDO stores readable text.
const FIELD_SERVICES={corte:'Corte',fixacao:'Fixação',chumbamento:'Chumbamento',afaq:'AF/AQ',esgoto:'Esgoto aéreo',dreno:'Dreno'}
const FIELD_RESULTS={completed:'concluído',in_progress:'continua em execução',no_progress:'sem avanço relevante',blocked:'bloqueado',inspection:'em verificação',finished:'finalizado',running:'em execução',paused:'pausado'}
const floorLabel=n=>n===0?'Térreo':n<0?'Subsolo '+Math.abs(n):n+'º pavimento'
function serviceLabel(key,stages){
  const value=clean(key)
  const stage=/^etapa:(\d+)$/.exec(value)
  if(stage)return stages.get(Number(stage[1]))||'Etapa da obra'
  return FIELD_SERVICES[value]||value||'Serviço'
}
function buildReport(report,stages=new Map()){
  const day=record(report.report)
  const activities=list(day.sessions).filter(s=>s&&typeof s==='object').slice(0,200)
    .map(s=>`${serviceLabel(s.service,stages)}${Number.isFinite(Number(s.floor))&&clean(s.floor)!==''?' · '+floorLabel(Number(s.floor)):''} · ${FIELD_RESULTS[clean(s.result||s.state)]||clean(s.result||s.state)||'apontamento'}`).join('\n').slice(0,20000)
  const notes=[clean(day.note),...list(day.events).slice(0,100).map(e=>clean(record(e).label)).filter(Boolean)]
    .filter(Boolean).join('\n').slice(0,20000)
  return {activities,notes}
}
export const MANUAL_RDO_MARKER='RDO digitado no escritório'
const brDate=value=>value.split('-').reverse().join('/')
const mergeText=(base,field)=>[clean(base),clean(field)?'— Registro do celular —\n'+clean(field):''].filter(Boolean).join('\n\n')
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
    let oldLink=this.db.prepare('SELECT * FROM field_rdo_links WHERE remote_project_id=? AND day=?').get(remoteProjectId,date)
    const photos=validatePhotos(list(day.photos))
    const stages=new Map(this.db.prepare('SELECT id,nome FROM etapas_obra WHERE obra_id=? AND deleted_at IS NULL').all(workId).map(row=>[Number(row.id),clean(row.nome)]))
    const fields=buildReport(report,stages)
    // Resolve people who belong to the company, not only today's active crew:
    // an RDO from yesterday stays valid after an employee changes work or leaves.
    const crew=()=>crewRows(day.sessions,new FieldRdoCatalog({repository:this.repository}).companyPeople(companyId,workId))
    const existing=!oldLink&&this.db.prepare('SELECT id FROM rdos WHERE obra_id=? AND data=? AND deleted_at IS NULL').get(workId,date)
    if(existing){
      crew()
      try{this.linkManual({scope,date})}
      catch(error){throw Object.assign(new Error(error.message),{code:'MANUAL_RDO_EXISTS',rdoId:existing.id})}
      oldLink=this.db.prepare('SELECT * FROM field_rdo_links WHERE remote_project_id=? AND day=?').get(remoteProjectId,date)
    }
    let team
    let rdo
    if(oldLink){
      rdo=this.repository.get('rdos',Number(oldLink.rdo_id))
      if(!rdo||rdo.deleted_at||Number(rdo.obra_id)!==workId||rdo.data!==date)throw new Error('Vínculo do RDO canônico inconsistente.')
      if(oldLink.last_fingerprint===fingerprint){
        const stored=this.db.prepare('SELECT photo_id,sha256 FROM field_rdo_evidencias WHERE rdo_id=? AND active=1').all(rdo.id)
        if(stored.length!==photos.length||photos.some(p=>!stored.some(s=>s.photo_id===p.id&&s.sha256===p.sha256)))
         throw new Error('Evidência canônica alterada ou ausente: nova conferência necessária.')
        const materials=this.materials.list(rdo.id)
        return {localRdoId:rdo.id,materialRevision:materials.revision,replayed:true,materialPending:materials.pending?.message||null}
      }
      if(oldLink.last_rdo_hash&&oldLink.last_rdo_hash!==contentHash(rdo))throw new Error('O RDO foi alterado no Desktop após a última integração. Revise antes de importar novamente.')
      const currentRevision=this.materials.list(rdo.id).revision
      if(oldLink.last_material_revision!=null && currentRevision!==Number(oldLink.last_material_revision)){
        const key='field-rdo:'+digest(remoteProjectId+'|'+date+'|'+fingerprint).slice(0,64)
        const receipt=this.db.prepare('SELECT revisao FROM rdo_material_requisicoes WHERE rdo_id=? AND request_id=?').get(rdo.id,key)
        if(Number(receipt?.revisao)!==currentRevision)throw new Error('O consumo foi alterado no Desktop após a última integração.')
      }
      if(['fechado','finalizado','concluido'].includes(rdo.status))throw new Error('Reabra o RDO canônico antes de atualizar o consumo.')
      team=crew()
      rdo=oldLink.manual_merge
        ?this.repository.save('rdos',{id:rdo.id,atividades:mergeText(oldLink.base_atividades,fields.activities),observacoes:mergeText(oldLink.base_observacoes,fields.notes)})
        :this.repository.save('rdos',{id:rdo.id,atividades:fields.activities,observacoes:fields.notes})
      this.db.prepare('UPDATE field_rdo_links SET last_rdo_hash=? WHERE remote_project_id=? AND day=?').run(contentHash(rdo),remoteProjectId,date)
    }else{
      team=crew()
      rdo=this.repository.save('rdos',{obra_id:workId,frente_id:null,data:date,clima:null,status:'rascunho',atividades:fields.activities,observacoes:fields.notes})
      this.db.prepare('INSERT INTO field_rdo_links(remote_project_id,day,rdo_id,last_rdo_hash) VALUES(?,?,?,?)')
        .run(remoteProjectId,date,rdo.id,contentHash(rdo))
    }
    // The RDO identity is durable before stock application. On an interruption
    // the retry reuses this identity and the idempotent materials operation.
    const requestId='field-rdo:'+digest(remoteProjectId+'|'+date+'|'+fingerprint).slice(0,64)
    const oldRevision=this.materials.list(rdo.id).revision
    // A diary joined to an office RDO keeps the office lines and adds the phone lines.
    let baseLines=[]
    if(oldLink?.manual_merge){try{baseLines=list(JSON.parse(oldLink.base_materiais_json||'[]'))}catch{baseLines=[]}}
    const desired=oldLink?.manual_merge?[...baseLines,...list(day.materials).map(row=>({...record(row),id:'campo:'+clean(record(row).id)}))]:list(day.materials)
    // Missing stock no longer blocks the diary: crew, photos and text are imported
    // and the consumption waits in the office until it can be applied.
    let materialReceipt,materialPending=null
    try{materialReceipt=this.materials.save({rdoId:rdo.id,requestId,expectedRevision:oldRevision,items:desired})}
    catch(error){
      if(error?.code!=='INSUFFICIENT_STOCK'||!this.materials.hasPendingTable())throw error
      materialPending=error.message
      materialReceipt={revision:oldRevision}
    }
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if(materialPending){
        this.db.prepare("DELETE FROM field_rdo_pendencias WHERE rdo_id=? AND kind='material' AND resolved_at IS NULL").run(rdo.id)
        this.db.prepare("INSERT INTO field_rdo_pendencias(rdo_id,kind,request_id,payload_json,message) VALUES(?,'material',?,?,?)")
          .run(rdo.id,requestId,JSON.stringify({items:desired}),materialPending)
      }
      this.db.prepare("DELETE FROM rdo_equipe WHERE rdo_id=? AND observacoes='[Obra360:equipe]'").run(rdo.id)
      const writePerson=this.db.prepare("INSERT INTO rdo_equipe(rdo_id,funcionario_id,nome,horas,observacoes) VALUES(?,?,?,?,'[Obra360:equipe]')")
      for(const p of team)writePerson.run(rdo.id,p.localId,p.name,p.hours)
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
    return {localRdoId:rdo.id,materialRevision:materialReceipt.revision,replayed:false,materialPending}
  }

  retryPending(scope){
    if(!this.materials.hasPendingTable())return 0
    const pending=this.db.prepare(`SELECT r.id FROM field_rdo_pendencias p
      JOIN rdos r ON r.id=p.rdo_id
      JOIN obras w ON w.id=r.obra_id
      JOIN field_rdo_links l ON l.rdo_id=r.id AND l.day=r.data
      LEFT JOIN rdo_material_revisoes m ON m.rdo_id=r.id
      WHERE p.kind='material' AND p.resolved_at IS NULL
        AND l.remote_project_id=? AND w.id=? AND w.empresa_id=?
        AND w.deleted_at IS NULL AND r.deleted_at IS NULL
        AND COALESCE(r.status,'') NOT IN ('fechado','finalizado','concluido')
        AND l.last_material_revision=COALESCE(m.revisao,0)
      ORDER BY r.data,r.id`).all(scope.remoteProjectId,scope.workId,scope.companyId)
    let applied=0
    for(const {id} of pending){
      try{this.materials.applyPending(id);applied++}
      catch(error){if(error?.code!=='INSUFFICIENT_STOCK')throw error}
    }
    return applied
  }

  /** Joins the phone diary of a day to the RDO typed in the office, keeping the office content. */
  linkManual(input={}){
    const scope=record(input.scope),remoteProjectId=clean(scope.remoteProjectId),date=clean(input.date)
    const companyId=Number(scope.companyId),workId=Number(scope.workId)
    if(!remoteProjectId||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Obra ou data inválidas para juntar o RDO.')
    const work=this.repository.get('obras',workId)
    if(!work||work.deleted_at||Number(work.empresa_id)!==companyId)throw new Error('Obra não pertence à empresa autorizada.')
    if(this.db.prepare('SELECT 1 FROM field_rdo_links WHERE remote_project_id=? AND day=?').get(remoteProjectId,date))throw new Error('Este dia já está ligado a um RDO.')
    const rows=this.db.prepare('SELECT id FROM rdos WHERE obra_id=? AND data=? AND deleted_at IS NULL').all(workId,date)
    if(rows.length!==1)throw new Error(rows.length?'Há mais de um RDO no escritório neste dia; revise antes de juntar.':'Não há RDO digitado no escritório neste dia.')
    const rdo=this.repository.get('rdos',Number(rows[0].id))
    if(['fechado','finalizado','concluido'].includes(rdo.status))throw new Error('Reabra o RDO do escritório antes de juntar com o do celular.')
    if(this.db.prepare('SELECT 1 FROM field_rdo_links WHERE rdo_id=?').get(rdo.id))throw new Error('Este RDO já recebe outro diário do celular.')
    const current=this.materials.list(rdo.id)
    this.db.prepare(`INSERT INTO field_rdo_links(remote_project_id,day,rdo_id,last_rdo_hash,last_material_revision,manual_merge,base_atividades,base_observacoes,base_materiais_json)
      VALUES(?,?,?,?,?,1,?,?,?)`).run(remoteProjectId,date,rdo.id,contentHash(rdo),current.revision,rdo.atividades||'',rdo.observacoes||'',JSON.stringify(current.items))
    return {rdoId:rdo.id,date}
  }
}
