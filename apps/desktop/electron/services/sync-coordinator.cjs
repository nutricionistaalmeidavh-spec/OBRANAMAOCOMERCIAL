const { createHash, randomUUID } = require('node:crypto')
const BRIDGE = { frentes_obra: 'fronts', tarefas_obra: 'tasks', rdos: 'rdos', cronograma_etapas: 'schedule' }
const EDITABLE = {
 frentes_obra:['status','observacoes'], tarefas_obra:['status','responsavel','prazo','prioridade','descricao','observacoes','titulo','concluido_em'],
 rdos:['status','clima','atividades','observacoes'], cronograma_etapas:['status','percentual_realizado','observacoes','responsavel','previsto_inicio','previsto_fim']
}
const json = JSON.stringify
const hash = value => createHash('sha256').update(json(value)).digest('hex')
const payloadOf = row => Object.fromEntries(Object.entries({...row,deleted:!!row.deleted_at}).filter(([key])=>!['created_at','updated_at'].includes(key)).sort(([a],[b])=>a.localeCompare(b)))
class SyncCoordinator {
 constructor({database,online,now=Date.now}) { this.database=database; this.online=online; this.now=now; this.running=null; this.timer=null; this.generation=0 }
 get db(){return this.database.db}
 binding(){const row=this.db.prepare('SELECT * FROM desktop_sync_scope WHERE id=1').get();return row?{...row,scope:JSON.parse(row.binding)}:null}
 key(scope){return hash(scope ? [scope.companyId,scope.workId,scope.baseUrl,scope.deviceId,scope.remoteCompanyId,scope.remoteProjectId] : null)}
 state(){
  const b=this.binding(),connection=this.online.state(),scope=b?.scope
  const paused=!scope||!connection.linked||connection.baseUrl!==scope.baseUrl
  const conflicts=scope?this.db.prepare("SELECT id,entity,local_id AS localId,remote_revision AS remoteRevision,remote_conflict_id AS remoteConflictId,created_at AS createdAt,remote_payload FROM desktop_sync_conflicts WHERE scope_key=? AND status='open'").all(this.key(scope)).map(c=>{
   const fields=EDITABLE[c.entity]||[]
   const local=BRIDGE[c.entity]?this.db.prepare(`SELECT * FROM ${c.entity} WHERE id=? AND obra_id=?`).get(c.localId,scope.workId):null
   const remote=JSON.parse(c.remote_payload)
   const select=value=>Object.fromEntries([...fields,'deleted'].filter(k=>value&&Object.hasOwn(value,k)).map(k=>[k,value[k]]))
   const {remote_payload,...item}=c
   return {...item,localPayload:select(local),remotePayload:select(remote)}
  }):[]
  return {configured:!!scope,paused,running:!!this.running,scope:scope||null,lastSyncAt:b?.last_sync_at||null,lastError:b?.last_error||null,pending:scope?this.db.prepare("SELECT COUNT(*) n FROM desktop_sync_outbox WHERE scope_key=? AND status='pending'").get(this.key(scope)).n:0,conflicts}
 }
 async configure({companyId,workId}){
  if(this.running)throw new Error('Aguarde a sincronização atual terminar.')
  const work=this.db.prepare('SELECT * FROM obras WHERE id=? AND empresa_id=? AND deleted_at IS NULL').get(Number(workId),Number(companyId))
  if(!work)throw new Error('Selecione uma obra pertencente à empresa local.')
  const session=await this.online.session(),connection=this.online.state()
  if(!session.authorized||!session.company?.id||!session.project?.id||!session.device?.id)throw new Error('Vincule o dispositivo a uma empresa e obra online primeiro.')
  const company=this.db.prepare('SELECT * FROM empresas WHERE id=?').get(Number(companyId))
  const scope={companyId:Number(companyId),workId:Number(workId),companyName:company.razao_social||company.nome_fantasia||String(companyId),workName:work.nome,baseUrl:connection.baseUrl,deviceId:String(session.device.id),remoteCompanyId:String(session.company.id),remoteProjectId:String(session.project.id)}
  const old=this.binding();if(old&&this.key(old.scope)===this.key(scope))return this.state()
  this.db.prepare('INSERT INTO desktop_sync_scope(id,binding) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET binding=excluded.binding,remote_revision=0,last_sync_at=NULL,last_error=NULL,snapshot=NULL').run(json(scope))
  this.db.prepare('UPDATE desktop_sync_scope SET allowed_modules=? WHERE id=1').run(json(session.access?.modules||[]))
  this.capture(scope,session.access?.modules||[]);return this.state()
 }
 async stop(){this.generation++;if(this.timer)clearInterval(this.timer);this.timer=null;await this.running?.catch(()=>{})}
 start(intervalMs=60000){if(this.timer)return;this.timer=setInterval(()=>this.run().catch(()=>{}),intervalMs);this.timer.unref?.();this.run().catch(()=>{})}
 assertScope(scope,generation){const connection=this.online.state();if(generation!==this.generation||!connection.linked||connection.baseUrl!==scope.baseUrl||this.key(this.binding()?.scope)!==this.key(scope))throw new Error('Sincronização pausada: conexão ou escopo alterado.')}
 async validate(scope,generation){this.assertScope(scope,generation);const s=await this.online.session();this.assertScope(scope,generation);if(!s.authorized||String(s.device?.id)!==scope.deviceId||String(s.company?.id)!==scope.remoteCompanyId||String(s.project?.id)!==scope.remoteProjectId)throw new Error('Vínculo online mudou. Confirme novamente a empresa e obra locais.');return s.access?.modules||[]}
 enqueue(scope,kind,entity,localId,payload){const key=this.key(scope),digest=hash(payload),head=this.db.prepare('SELECT * FROM desktop_sync_heads WHERE scope_key=? AND entity=? AND local_id=?').get(key,entity,localId);if(head?.captured_hash===digest)return
  this.db.prepare('INSERT INTO desktop_sync_outbox(change_id,scope_key,kind,entity,local_id,payload,payload_hash) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),key,kind,entity,localId,json(payload),digest)
  this.db.prepare('INSERT INTO desktop_sync_heads(scope_key,entity,local_id,captured_hash) VALUES(?,?,?,?) ON CONFLICT(scope_key,entity,local_id) DO UPDATE SET captured_hash=excluded.captured_hash').run(key,entity,localId,digest)
  this.db.prepare('INSERT INTO auditoria(entidade,entidade_id,acao,dados) VALUES(?,?,?,?)').run(entity,localId,'SYNC_QUEUED',json({scope:key,hash:digest}))
 }
 rows(table,scope){return this.db.prepare(`SELECT * FROM ${table} WHERE obra_id=?`).all(scope.workId)}
 capture(scope,modules){this.db.transaction(()=>{
  if(modules.includes('obra360'))for(const entity of Object.keys(BRIDGE)){const rows=this.rows(entity,scope);for(const row of rows)this.enqueue(scope,'bridge',entity,row.id,payloadOf(row));const seen=new Set(rows.map(x=>x.id));for(const old of this.db.prepare('SELECT local_id FROM desktop_sync_heads WHERE scope_key=? AND entity=?').all(this.key(scope),entity))if(!seen.has(old.local_id))this.enqueue(scope,'bridge',entity,old.local_id,{id:old.local_id,obra_id:scope.workId,deleted:true})}
  this.enqueue(scope,'summary','mobile_summary',0,this.summary(scope,modules))
  if(modules.some(m=>['finance','rh','dre'].includes(m)))for(const obligation of this.obligations(scope))this.enqueue(scope,'finance','finance_reference',Number(obligation.sourceId.split(':').at(-1)),obligation)
 })()}
 summary(scope,allowed){
  const rows=table=>this.rows(table,scope).filter(x=>!x.deleted_at)
  const accounts=this.db.prepare(`SELECT c.*, COALESCE((SELECT SUM(p.valor_centavos) FROM pagamentos_conta p WHERE p.conta_id=c.id),0) paid_cents FROM contas c WHERE empresa_id=? AND obra_id=? AND deleted_at IS NULL`).all(scope.companyId,scope.workId)
  const today=new Date(this.now()).toISOString().slice(0,10),stages=rows('cronograma_etapas'),rdos=rows('rdos')
  const paid=type=>accounts.filter(x=>x.tipo===type).reduce((n,x)=>n+x.paid_cents,0)
  const open=type=>accounts.filter(x=>x.tipo===type&&!['pago','recebido','quitado','cancelado'].includes(x.status))
  const sum=xs=>xs.reduce((n,x)=>n+Math.max(0,x.valor_centavos-x.paid_cents),0)
  const work=this.db.prepare('SELECT * FROM obras WHERE id=? AND empresa_id=?').get(scope.workId,scope.companyId)
  if(!work||work.deleted_at)throw new Error('Obra local não está disponível para sincronização.')
  const modules={
   obra360:{physicalProgress:work.percentual_fisico,activeStages:stages.filter(x=>!['concluida','concluido','cancelada'].includes(x.status)).length,overdueStages:stages.filter(x=>x.previsto_fim&&x.previsto_fim<today&&!['concluida','concluido','cancelada'].includes(x.status)).length},
   rdo:{total:rdos.length,pending:rdos.filter(x=>!['fechado','finalizado'].includes(x.status)).length,finalized:rdos.filter(x=>['fechado','finalizado'].includes(x.status)).length},
   dre:{revenue:paid('receber'),expense:paid('pagar'),result:paid('receber')-paid('pagar')},
   finance:{payableCents:sum(open('pagar')),receivableCents:sum(open('receber')),overdueCents:sum(open('pagar').filter(x=>x.vencimento<today)),scope:'work'},
   documents:{total:rows('documentos').length,expiring30d:rows('documentos').filter(x=>x.vencimento&&x.vencimento>=today&&x.vencimento<=new Date(this.now()+30*86400000).toISOString().slice(0,10)).length}
  }
  return {scope:{companyId:scope.remoteCompanyId,projectId:scope.remoteProjectId,workName:scope.workName,period:'Histórico da obra · caixa'},modules:Object.fromEntries(Object.entries(modules).filter(([k])=>allowed.includes(k)))}
 }
 obligations(scope){return this.db.prepare("SELECT c.*,f.nome AS beneficiary FROM contas c LEFT JOIN fornecedores f ON f.id=c.fornecedor_id WHERE c.empresa_id=? AND c.obra_id=? AND c.tipo='pagar' ORDER BY c.id").all(scope.companyId,scope.workId).map(c=>({sourceId:`${scope.deviceId}:conta:${c.id}`,sourceType:'payable',beneficiaryName:c.beneficiary||c.descricao,description:c.descricao,amountCents:c.valor_centavos,dueDate:c.vencimento,competence:c.competencia,projectId:scope.remoteProjectId,status:c.deleted_at?'cancelled':c.status}))}
 conflict(scope,entity,localId,payload,revision,remoteId=null){this.db.prepare("INSERT INTO desktop_sync_conflicts(scope_key,entity,local_id,remote_payload,remote_revision,remote_conflict_id) VALUES(?,?,?,?,?,?) ON CONFLICT(scope_key,entity,local_id) WHERE status='open' DO UPDATE SET remote_payload=excluded.remote_payload,remote_revision=excluded.remote_revision,remote_conflict_id=COALESCE(excluded.remote_conflict_id,desktop_sync_conflicts.remote_conflict_id)").run(this.key(scope),entity,localId,json(payload),revision,remoteId)}
 applyRemote(scope,entity,id,payload){const row=this.db.prepare(`SELECT * FROM ${entity} WHERE id=? AND obra_id=?`).get(id,scope.workId);if(!row)return false;const cols=new Set(this.db.prepare(`PRAGMA table_info(${entity})`).all().map(x=>x.name)),patch=Object.fromEntries((EDITABLE[entity]||[]).filter(k=>cols.has(k)&&Object.hasOwn(payload,k)).map(k=>[k,payload[k]]));if(payload.deleted)throw new Error('Exclusão remota exige revisão manual no cadastro local.');if(Object.keys(patch).length)this.db.prepare(`UPDATE ${entity} SET ${Object.keys(patch).map(k=>k+'=?').join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=? AND obra_id=?`).run(...Object.values(patch),id,scope.workId);this.db.prepare('INSERT INTO auditoria(entidade,entidade_id,acao,dados) VALUES(?,?,?,?)').run(entity,id,'SYNC_REMOTE_APPLIED',json({fields:Object.keys(patch)}));return true}
 ingest(scope,pull){if(!pull.changed)return;const snapshot=pull.snapshot;if(!snapshot||typeof snapshot!=='object')throw new Error('Snapshot online inválido.');this.db.transaction(()=>{
  for(const [entity,bucket] of Object.entries(BRIDGE))for(const item of snapshot.desktopBridge?.[bucket]||[]){if(String(item.sourceDeviceId)!==scope.deviceId||!Number.isSafeInteger(Number(item.localId)))continue;const id=Number(item.localId),head=this.db.prepare('SELECT * FROM desktop_sync_heads WHERE scope_key=? AND entity=? AND local_id=?').get(this.key(scope),entity,id);if(!head||Number(item.mobileEditedRevision||0)<=head.remote_revision)continue;const row=this.db.prepare(`SELECT * FROM ${entity} WHERE id=? AND obra_id=?`).get(id,scope.workId),pending=this.db.prepare("SELECT COUNT(*) n FROM desktop_sync_outbox WHERE scope_key=? AND entity=? AND local_id=? AND status='pending'").get(this.key(scope),entity,id).n;
   if(!row||pending||hash(payloadOf(row))!==head.acknowledged_hash||item.payload?.deleted){this.conflict(scope,entity,id,item.payload||{},Number(item.mobileEditedRevision));continue}
   this.applyRemote(scope,entity,id,item.payload||{});const updated=this.db.prepare(`SELECT * FROM ${entity} WHERE id=?`).get(id),digest=hash(payloadOf(updated));this.db.prepare('UPDATE desktop_sync_heads SET captured_hash=?,acknowledged_hash=?,remote_revision=? WHERE scope_key=? AND entity=? AND local_id=?').run(digest,digest,Number(item.mobileEditedRevision),this.key(scope),entity,id)
  }
  this.db.prepare('UPDATE desktop_sync_scope SET snapshot=?,remote_revision=? WHERE id=1').run(json(snapshot),Number(pull.remoteRevision||0))
 })()}
 supersede(scope,job,reason){this.db.transaction(()=>{this.db.prepare("UPDATE desktop_sync_outbox SET status='superseded',last_error=? WHERE id=? AND status='pending'").run(reason,job.id);this.db.prepare("UPDATE desktop_sync_heads SET captured_hash=COALESCE(acknowledged_hash,'') WHERE scope_key=? AND entity=? AND local_id=?").run(this.key(scope),job.entity,job.local_id)})()}
 hasEarlierPending(scope,job){return !!this.db.prepare("SELECT id FROM desktop_sync_outbox WHERE scope_key=? AND kind=? AND entity=? AND local_id=? AND status='pending' AND id<? LIMIT 1").get(this.key(scope),job.kind,job.entity,job.local_id,job.id)}
 run(options={}){if(this.running)return this.running;this.running=this.perform(options).finally(()=>{this.running=null});return this.running}
 async perform({retryNow=false}={}){const b=this.binding();if(!b)return this.state();const scope=b.scope,generation=this.generation;try{this.capture(scope,JSON.parse(b.allowed_modules||'[]'));const modules=await this.validate(scope,generation);this.db.prepare('UPDATE desktop_sync_scope SET allowed_modules=? WHERE id=1').run(json(modules));this.capture(scope,modules);if(modules.includes('obra360')){const pull=await this.online.syncPull(b.remote_revision);this.assertScope(scope,generation);this.ingest(scope,pull)}
  const adminModules=modules.some(m=>['finance','rh','dre'].includes(m)),queue=this.db.prepare("SELECT * FROM desktop_sync_outbox WHERE scope_key=? AND status='pending' ORDER BY id").all(this.key(scope));for(const job of queue){this.assertScope(scope,generation);if(job.kind==='bridge'&&!modules.includes('obra360')){this.supersede(scope,job,'Módulo Obra360 não está mais liberado para este Desktop.');continue}if(job.kind==='finance'&&!adminModules){this.supersede(scope,job,'Módulos administrativos não estão mais liberados para este Desktop.');continue}if(!retryNow&&job.next_attempt_at>this.now())continue;if(this.hasEarlierPending(scope,job))continue;if(this.db.prepare("SELECT id FROM desktop_sync_conflicts WHERE scope_key=? AND entity=? AND local_id=? AND status='open'").get(this.key(scope),job.entity,job.local_id))continue;
   try{const payload=JSON.parse(job.payload);let reply;if(job.kind==='bridge'){const head=this.db.prepare('SELECT remote_revision FROM desktop_sync_heads WHERE scope_key=? AND entity=? AND local_id=?').get(this.key(scope),job.entity,job.local_id);reply=await this.online.syncPush([{changeId:job.change_id,entity:job.entity,localId:job.local_id,baseMobileRevision:head?.remote_revision||0,payload}]);this.assertScope(scope,generation);const result=reply.accepted?.find(x=>x.changeId===job.change_id);if(!result)throw new Error('Servidor não confirmou a alteração.');if(result.conflict||result.status==='conflict'){this.conflict(scope,job.entity,job.local_id,payload,Number(result.currentMobileRevision||0),result.conflictId);continue}if(!['accepted','duplicate'].includes(result.status)||result.bridged===false)throw new Error('Alteração não aplicada à obra online.')}
    else if(job.kind==='summary'){reply=await this.online.publishMobileSummary({...payload,modules:Object.fromEntries(Object.entries(payload.modules||{}).filter(([key])=>modules.includes(key))),generatedAt:new Date(this.now()).toISOString()});if(!reply.ok)throw new Error('Resumo não confirmado.')}
    else {reply=await this.online.publishFinanceReference([payload]);if(reply.accepted!==1)throw new Error('Obrigação não confirmada.')}
    this.assertScope(scope,generation);this.db.transaction(()=>{this.db.prepare("UPDATE desktop_sync_outbox SET status='sent',last_error=NULL WHERE id=?").run(job.id);this.db.prepare('UPDATE desktop_sync_heads SET acknowledged_hash=? WHERE scope_key=? AND entity=? AND local_id=?').run(job.payload_hash,this.key(scope),job.entity,job.local_id)})()
   }catch(error){this.db.prepare('UPDATE desktop_sync_outbox SET attempts=attempts+1,next_attempt_at=?,last_error=? WHERE id=?').run(this.now()+Math.min(3600000,15000*2**Math.min(job.attempts,8)),String(error.message),job.id);throw error}
  }
  this.assertScope(scope,generation);this.db.prepare('UPDATE desktop_sync_scope SET last_sync_at=?,last_error=NULL WHERE id=1').run(new Date(this.now()).toISOString())
 }catch(error){if(this.db?.open)this.db.prepare('UPDATE desktop_sync_scope SET last_error=? WHERE id=1').run(String(error.message));throw error}return this.state()}
 async resolveLocalConflict(id,resolution){if(this.running)throw new Error('Aguarde a sincronização atual terminar.');if(!['keep_local','accept_remote'].includes(resolution))throw new Error('Resolução inválida.');const scope=this.binding()?.scope;if(!scope)throw new Error('Configure a sincronização.');const generation=this.generation;await this.validate(scope,generation);const conflict=this.db.prepare("SELECT * FROM desktop_sync_conflicts WHERE id=? AND scope_key=? AND status='open'").get(Number(id),this.key(scope));if(!conflict)throw new Error('Conflito não encontrado.');const pull=await this.online.syncPull(0);this.assertScope(scope,generation);const item=(pull.snapshot?.desktopBridge?.[BRIDGE[conflict.entity]]||[]).find(x=>String(x.sourceDeviceId)===scope.deviceId&&Number(x.localId)===conflict.local_id);if(!item)throw new Error('Registro remoto não encontrado; revise o vínculo antes de resolver.');if(Number(item.mobileEditedRevision||0)!==conflict.remote_revision){this.conflict(scope,conflict.entity,conflict.local_id,item.payload||{},Number(item.mobileEditedRevision||0),conflict.remote_conflict_id);throw new Error('O registro online mudou; atualize e revise o conflito novamente.');}if(conflict.remote_conflict_id){
   // Close the stale proposal without replaying its old desktop payload.
   // keep_local captures and sends the CURRENT local row on the next run.
   const result=await this.online.resolveConflict(conflict.remote_conflict_id,'keep_mobile');this.assertScope(scope,generation);if(result?.ok===false)throw new Error('Conflito online não confirmado.')}
  this.db.transaction(()=>{if(resolution==='accept_remote'&&!this.applyRemote(scope,conflict.entity,conflict.local_id,item.payload))throw new Error('Registro local ausente.');this.db.prepare("UPDATE desktop_sync_outbox SET status='superseded' WHERE scope_key=? AND entity=? AND local_id=? AND status='pending'").run(this.key(scope),conflict.entity,conflict.local_id);this.db.prepare("UPDATE desktop_sync_conflicts SET status=? WHERE id=?").run(resolution,id);const row=this.db.prepare(`SELECT * FROM ${conflict.entity} WHERE id=? AND obra_id=?`).get(conflict.local_id,scope.workId);if(!row)throw new Error('Registro local ausente.');const digest=hash(payloadOf(row));this.db.prepare('UPDATE desktop_sync_heads SET captured_hash=?,acknowledged_hash=?,remote_revision=? WHERE scope_key=? AND entity=? AND local_id=?').run(resolution==='accept_remote'?digest:'',resolution==='accept_remote'?digest:null,Number(item.mobileEditedRevision||0),this.key(scope),conflict.entity,conflict.local_id)})();return this.state()
 }
}
module.exports={SyncCoordinator}