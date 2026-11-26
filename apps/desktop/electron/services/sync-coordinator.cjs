const { createHash, randomUUID } = require('node:crypto')
const { LocalSyncDataProvider, BRIDGE, EDITABLE, payloadOf } = require('./sync-data-provider.cjs')
const {localRdoBinding}=require('./local-rdo-binding.cjs')
const json = JSON.stringify
const hash = value => createHash('sha256').update(json(value)).digest('hex')
const resolved = value => Promise.resolve(value)

class SyncCoordinator {
 constructor({database,online,dataProvider=null,now=Date.now,onStateChanged=null,scopeRow=null}) { this.scopeTable=scopeRow?.table||'desktop_sync_scope'; this.scopeId=Number(scopeRow?.id||1); this.isPrimary=this.scopeTable==='desktop_sync_scope'; this.database=database; this.online=online; this.now=now; this.dataProvider=dataProvider||new LocalSyncDataProvider({database,now}); this.onStateChanged=typeof onStateChanged==='function'?onStateChanged:null; this.lastStateDigest=''; this.running=null; this.timer=null; this.generation=0 }
 get db(){return this.database.db}
 binding(){const row=this.db.prepare(`SELECT * FROM ${this.scopeTable} WHERE id=?`).get(this.scopeId);return row?{...row,scope:JSON.parse(row.binding)}:null}
 key(scope){if(!scope)return hash(null);const parts=[scope.companyId,scope.workId,scope.baseUrl,scope.deviceId,scope.remoteCompanyId,scope.remoteProjectId];if(scope.storageMode==='remote')parts.push('remote',scope.serverId);return hash(parts)}
 runtimeState(){return this.dataProvider.runtimeState?.()||{source:'local',paused:false,pauseReason:null}}
 state(){
  const b=this.binding(),connection=this.online.state(),scope=b?.scope,runtime=this.runtimeState()
  const mismatch=!!scope&&((runtime.source==='remote'&&(scope.storageMode!=='remote'||String(scope.serverId||'')!==String(this.dataProvider.storage?.state?.()?.serverId||'')))||(runtime.source!=='remote'&&scope.storageMode==='remote'))
  const paused=runtime.paused||mismatch||!scope||!connection.linked||connection.baseUrl!==scope.baseUrl
  const pauseReason=!scope && !runtime.paused && this.bootstrapReason ? this.bootstrapReason : mismatch?'O servidor operacional mudou. Confirme novamente o vínculo da obra antes de sincronizar.':runtime.paused?runtime.pauseReason:null
  const conflicts=scope?this.db.prepare("SELECT id,entity,local_id AS localId,remote_revision AS remoteRevision,remote_conflict_id AS remoteConflictId,created_at AS createdAt,remote_payload FROM desktop_sync_conflicts WHERE scope_key=? AND status='open'").all(this.key(scope)).map(c=>{
   const fields=EDITABLE[c.entity]||[]
   let local=null
   if(BRIDGE[c.entity]){
    if(this.dataProvider.peekBridge)local=this.dataProvider.peekBridge(c.entity,c.localId,scope)
    else if(runtime.source==='local'){const value=this.dataProvider.getBridge(c.entity,c.localId,scope);if(!value?.then)local=value}
   }
   const remote=JSON.parse(c.remote_payload)
   const select=value=>Object.fromEntries([...fields,'deleted'].filter(k=>value&&Object.hasOwn(value,k)).map(k=>[k,value[k]]))
   const {remote_payload,...item}=c
   return {...item,localPayload:select(local),remotePayload:select(remote)}
  }):[]
  return {configured:!!scope,paused,source:runtime.source,pauseReason,running:!!this.running,scope:scope||null,lastSyncAt:b?.last_sync_at||null,lastError:b?.last_error||null,pending:scope?this.db.prepare("SELECT COUNT(*) n FROM desktop_sync_outbox WHERE scope_key=? AND status='pending'").get(this.key(scope)).n:0,conflicts,fieldRdoIssues:Array.isArray(this.fieldRdoIssues)?this.fieldRdoIssues.slice(0,20):[],fieldRdoPendingConsumption:this.pendingConsumption(scope,runtime),...(this.isPrimary?{projects:this.projectStates(),projectIssues:Array.isArray(this.projectIssues)?this.projectIssues:[]}:{})}
 }
 notify(){
  const next=this.state(),digest=json(next)
  if(digest===this.lastStateDigest)return next
  this.lastStateDigest=digest
  try{this.onStateChanged?.(next)}catch{}
  return next
 }
 async configure({companyId,workId}){
  if(this.running)throw new Error('Aguarde a sincronização atual terminar.')
  const runtime=this.runtimeState();if(runtime.paused)throw new Error(`Sincronização pausada: ${runtime.pauseReason}`)
  const source=await resolved(this.dataProvider.resolveScope({companyId:Number(companyId),workId:Number(workId)}))
  const session=await this.online.session(),connection=this.online.state()
  if(!session.authorized||!session.company?.id||!session.project?.id||!session.device?.id)throw new Error('Vincule o dispositivo a uma empresa e obra online primeiro.')
  const scope={...source,baseUrl:connection.baseUrl,deviceId:String(session.device.id),remoteCompanyId:String(session.company.id),remoteProjectId:String(session.project.id)}
  if(runtime.source==='remote'){
   if(typeof this.online.claimRemoteSyncOwner!=='function')throw new Error('Autoridade de sincronização remota não configurada.')
   const serverId=String(this.dataProvider.storage?.state?.()?.serverId||'').trim()
   if(!serverId)throw new Error('Servidor próprio ainda não possui identidade válida para sincronização.')
   await this.online.claimRemoteSyncOwner(serverId)
   scope.storageMode='remote';scope.serverId=serverId
  }
  const old=this.binding();if(old&&this.key(old.scope)===this.key(scope))return this.state()
  this.db.prepare('INSERT INTO desktop_sync_scope(id,binding) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET binding=excluded.binding,remote_revision=0,last_sync_at=NULL,last_error=NULL,snapshot=NULL').run(json(scope))
  this.db.prepare(`UPDATE ${this.scopeTable} SET allowed_modules=? WHERE id=?`).run(json(session.access?.modules||[]),this.scopeId)
  await this.capture(scope,session.access?.modules||[]);return this.notify()
 }
 async stop(){this.generation++;if(this.timer)clearInterval(this.timer);this.timer=null;await this.running?.catch(()=>{});this.notify()}
 start(intervalMs=60000){if(this.timer)return;this.timer=setInterval(()=>this.run().catch(()=>{}),intervalMs);this.timer.unref?.();this.notify();this.run().catch(()=>{})}
 assertScope(scope,generation){const runtime=this.runtimeState();if(runtime.paused)throw new Error(`Sincronização pausada: ${runtime.pauseReason}`);if(runtime.source==='remote'&&(scope.storageMode!=='remote'||String(scope.serverId||'')!==String(this.dataProvider.storage?.state?.()?.serverId||'')))throw new Error('Servidor próprio alterado; reconfirme o vínculo antes de sincronizar.');if(runtime.source!=='remote'&&scope.storageMode==='remote')throw new Error('Modo operacional alterado; reconfirme o vínculo antes de sincronizar.');const connection=this.online.state();if(generation!==this.generation||!connection.linked||connection.baseUrl!==scope.baseUrl||this.key(this.binding()?.scope)!==this.key(scope))throw new Error('Sincronização pausada: conexão ou escopo alterado.')}
 async validate(scope,generation){this.assertScope(scope,generation);const s=await this.online.session();this.assertScope(scope,generation);if(!s.authorized||String(s.device?.id)!==scope.deviceId||String(s.company?.id)!==scope.remoteCompanyId||String(s.project?.id)!==scope.remoteProjectId)throw new Error('Vínculo online mudou. Confirme novamente a empresa e obra locais.');this.online.assertAccountEmail?.(s.user?.email);return s.access?.modules||[]}
 enqueue(scope,kind,entity,localId,payload){const key=this.key(scope),digest=hash(payload),head=this.db.prepare('SELECT * FROM desktop_sync_heads WHERE scope_key=? AND entity=? AND local_id=?').get(key,entity,localId);if(head?.captured_hash===digest)return
  this.db.prepare('INSERT INTO desktop_sync_outbox(change_id,scope_key,kind,entity,local_id,payload,payload_hash) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),key,kind,entity,localId,json(payload),digest)
  this.db.prepare('INSERT INTO desktop_sync_heads(scope_key,entity,local_id,captured_hash) VALUES(?,?,?,?) ON CONFLICT(scope_key,entity,local_id) DO UPDATE SET captured_hash=excluded.captured_hash').run(key,entity,localId,digest)
  this.db.prepare('INSERT INTO auditoria(entidade,entidade_id,acao,dados) VALUES(?,?,?,?)').run(entity,localId,'SYNC_QUEUED',json({scope:key,hash:digest}))
 }
 rows(table,scope){return this.dataProvider.listBridge(table,scope)}
 async syncPlan(modules){
  const capabilities=this.dataProvider.syncCapabilities?await resolved(this.dataProvider.syncCapabilities()):null
  const bridgeEntities=modules.includes('obra360')?(capabilities?((capabilities.bridgeEntities||[]).filter(entity=>Object.hasOwn(BRIDGE,entity))):Object.keys(BRIDGE)):[]
  const summary=!capabilities||capabilities.modules?.includes('summary')
  const obligations=modules.some(m=>['finance','rh','dre'].includes(m))&&(!capabilities||capabilities.modules?.includes('finance'))
  return {capabilities,bridgeEntities,summary,obligations}
 }
 async capture(scope,modules){
  const plan=await this.syncPlan(modules),bridge=[]
  for(const entity of plan.bridgeEntities)bridge.push([entity,await resolved(this.rows(entity,scope))])
  const summary=plan.summary?await resolved(this.summary(scope,modules)):null
  const obligations=plan.obligations?await resolved(this.obligations(scope)):[]
  this.db.transaction(()=>{
   for(const [entity,rows] of bridge){for(const row of rows)this.enqueue(scope,'bridge',entity,row.id,payloadOf(row));const seen=new Set(rows.map(x=>x.id));for(const old of this.db.prepare('SELECT local_id FROM desktop_sync_heads WHERE scope_key=? AND entity=?').all(this.key(scope),entity))if(!seen.has(old.local_id))this.enqueue(scope,'bridge',entity,old.local_id,{id:old.local_id,obra_id:scope.workId,deleted:true})}
   if(summary!==null)this.enqueue(scope,'summary','mobile_summary',0,summary)
   for(const obligation of obligations)this.enqueue(scope,'finance','finance_reference',Number(obligation.sourceId.split(':').at(-1)),obligation)
  })()
  return plan
 }
 summary(scope,allowed){return this.dataProvider.summary(scope,allowed)}
 obligations(scope){return this.dataProvider.obligations(scope)}
 conflict(scope,entity,localId,payload,revision,remoteId=null){this.db.prepare("INSERT INTO desktop_sync_conflicts(scope_key,entity,local_id,remote_payload,remote_revision,remote_conflict_id) VALUES(?,?,?,?,?,?) ON CONFLICT(scope_key,entity,local_id) WHERE status='open' DO UPDATE SET remote_payload=excluded.remote_payload,remote_revision=excluded.remote_revision,remote_conflict_id=COALESCE(excluded.remote_conflict_id,desktop_sync_conflicts.remote_conflict_id)").run(this.key(scope),entity,localId,json(payload),revision,remoteId)}
 applyRemote(scope,entity,id,payload){return this.dataProvider.applyRemote(entity,id,payload,scope)}
 async ingest(scope,pull,bridgeEntities=Object.keys(BRIDGE)){if(!pull.changed)return;const snapshot=pull.snapshot;if(!snapshot||typeof snapshot!=='object')throw new Error('Snapshot online inválido.');
  for(const entity of bridgeEntities){const bucket=BRIDGE[entity];for(const item of snapshot.desktopBridge?.[bucket]||[]){if(String(item.sourceDeviceId)!==scope.deviceId||!Number.isSafeInteger(Number(item.localId)))continue;const id=Number(item.localId),head=this.db.prepare('SELECT * FROM desktop_sync_heads WHERE scope_key=? AND entity=? AND local_id=?').get(this.key(scope),entity,id);if(!head||Number(item.mobileEditedRevision||0)<=head.remote_revision)continue;const row=await resolved(this.dataProvider.getBridge(entity,id,scope)),pending=this.db.prepare("SELECT COUNT(*) n FROM desktop_sync_outbox WHERE scope_key=? AND entity=? AND local_id=? AND status='pending'").get(this.key(scope),entity,id).n;
   if(!row||pending||hash(payloadOf(row))!==head.acknowledged_hash||item.payload?.deleted){this.conflict(scope,entity,id,item.payload||{},Number(item.mobileEditedRevision));continue}
   await resolved(this.applyRemote(scope,entity,id,item.payload||{}));const updated=await resolved(this.dataProvider.getBridge(entity,id,scope)),digest=hash(payloadOf(updated));this.db.prepare('UPDATE desktop_sync_heads SET captured_hash=?,acknowledged_hash=?,remote_revision=? WHERE scope_key=? AND entity=? AND local_id=?').run(digest,digest,Number(item.mobileEditedRevision),this.key(scope),entity,id)
  }}
  this.db.prepare(`UPDATE ${this.scopeTable} SET snapshot=?,remote_revision=? WHERE id=?`).run(json(snapshot),Number(pull.remoteRevision||0),this.scopeId)
 }
 supersede(scope,job,reason){this.db.transaction(()=>{this.db.prepare("UPDATE desktop_sync_outbox SET status='superseded',last_error=? WHERE id=? AND status='pending'").run(reason,job.id);this.db.prepare("UPDATE desktop_sync_heads SET captured_hash=COALESCE(acknowledged_hash,'') WHERE scope_key=? AND entity=? AND local_id=?").run(this.key(scope),job.entity,job.local_id)})()}
 hasEarlierPending(scope,job){return !!this.db.prepare("SELECT id FROM desktop_sync_outbox WHERE scope_key=? AND kind=? AND entity=? AND local_id=? AND status='pending' AND id<? LIMIT 1").get(this.key(scope),job.kind,job.entity,job.local_id,job.id)}
 run(options={}){
  if(this.running)return this.running
  const task=(async()=>{
   try{
    let primaryError=null
    try{await this.perform(options)}catch(error){primaryError=error}
    // Each additional work is independent: one failing work never stops the others.
    if(this.isPrimary)await this.performProjects(options)
    if(primaryError)throw primaryError
   }
   finally{this.running=null;this.notify()}
   return this.state()
  })()
  this.running=task
  this.notify()
  return task
 }
 async syncFieldRdos(scope,generation){
  if(typeof this.dataProvider.applyFieldRdo!=='function'||typeof this.online.fieldRdoPending!=='function'||typeof this.online.fieldRdoAck!=='function')return
  this.assertScope(scope,generation)
  const issues=[]
  this.fieldRdoIssues=issues
  // A field RDO problem must never stop the rest of the synchronization: scope
  // errors still abort, every other failure is recorded and isolated.
  const isolate=(kind,report,error)=>{this.assertScope(scope,generation);const message=String(error?.message||error||'Falha desconhecida.').slice(0,300);
   // The office can resolve this one: join the phone diary to the RDO typed for that day.
   const code=error?.code==='MANUAL_RDO_EXISTS'||message.includes('RDO digitado no escritório')?'manual_rdo_exists':error?.code==='MATERIAL_PENDING'?'material_pending':null
   issues.push({kind,date:report?.date||null,message,at:new Date(this.now()).toISOString(),...(code?{code}:{})});return message}
  if(typeof this.dataProvider.fieldRdoCatalog==='function'&&typeof this.online.fieldRdoCatalogPublish==='function'){
   try{
    const catalog=await resolved(this.dataProvider.fieldRdoCatalog(scope))
    this.assertScope(scope,generation)
    if(catalog?.schemaVersion===1)await this.online.fieldRdoCatalogPublish(catalog)
   }catch(error){isolate('catalog',null,error)}
  }
  let pending
  const retryDates=Array.isArray(this.fieldRdoRetryDates)?this.fieldRdoRetryDates.slice(0,20):[]
  try{pending=await this.online.fieldRdoPending(retryDates.length?{retryDates}:undefined)}catch(error){isolate('transport',null,error);return}
  this.fieldRdoRetryDates=[]
  if(typeof this.dataProvider.retryFieldRdoMaterials==='function'){
   try{this.assertScope(scope,generation);await this.dataProvider.retryFieldRdoMaterials(scope)}
   catch(error){isolate('material',null,error)}
  }
  if(!Array.isArray(pending?.reports)||!pending.reports.length)return
  for(const report of pending.reports){
   this.assertScope(scope,generation)
   const identified=/^\d{4}-\d{2}-\d{2}$/.test(String(report?.date||''))&&!!report?.fingerprint
   const reject=async reason=>{if(identified&&typeof this.online.fieldRdoReject==='function')await this.online.fieldRdoReject({date:report.date,fingerprint:report.fingerprint,reason}).catch(error=>isolate('transport',report,error))}
   if(!identified){isolate('rdo',report,new Error('RDO mobile recebido sem identidade verificável.'));continue}
   const photos=Array.isArray(report.report?.photos)?report.report.photos:[]
   if(photos.length>60){await reject(isolate('rdo',report,new Error('Evidências fotográficas do RDO excederam o limite.')));continue}
   const verifiedPhotos=[]
   try{
    for(const p of photos){
     this.assertScope(scope,generation)
     if(typeof this.online.fieldRdoPhoto!=='function')throw new Error('Desktop não possui transporte autenticado de fotos.')
     if(!p?.id||!p?.sha256)throw new Error('Foto do RDO sem identidade ou SHA256.')
     const result=await this.online.fieldRdoPhoto({date:report.date,id:p.id,sha256:p.sha256})
     if(result?.photo?.id!==p.id||result.photo.contentType!==p.contentType||!result.photo.data)
      throw new Error('Servidor não retornou a fotografia canônica solicitada.')
     verifiedPhotos.push({...p,data:result.photo.data})
    }
   }catch(error){isolate('transport',report,error);continue}
   const complete={...report,report:{...report.report,photos:verifiedPhotos}}
   this.assertScope(scope,generation)
   let imported
   try{
    imported=await resolved(this.dataProvider.applyFieldRdo(scope,complete))
    this.assertScope(scope,generation)
    if(!Number.isSafeInteger(Number(imported?.localRdoId))||Number(imported?.localRdoId)<1)throw new Error('Fonte operacional não confirmou o RDO canônico.')
    if(!Number.isSafeInteger(Number(imported?.materialRevision)))throw new Error('Fonte operacional não confirmou a revisão do estoque.')
   }catch(error){await reject(isolate('rdo',report,error));continue}
   if(imported.materialPending)isolate('material',report,Object.assign(new Error('Diário integrado; consumo aguardando estoque no escritório: '+imported.materialPending),{code:'MATERIAL_PENDING'}))
   try{
    await this.online.fieldRdoAck({
     date:report.date,fingerprint:report.fingerprint,
     localRdoId:Number(imported.localRdoId),materialRevision:Number(imported.materialRevision),
     ...(imported.materialPending?{materialPending:String(imported.materialPending).slice(0,300)}:{})
    })
   }catch(error){isolate('transport',report,error)}
   this.assertScope(scope,generation)
  }
 }
 /** Phone consumption waiting for stock, read from the local operational base (persistent across cycles). */
 pendingConsumption(scope,runtime){
  if(!scope||runtime.source!=='local')return []
  try{
   if(!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='field_rdo_pendencias'").get())return []
   return this.db.prepare(`SELECT p.rdo_id AS rdoId,r.data AS date,p.message FROM field_rdo_pendencias p JOIN rdos r ON r.id=p.rdo_id
    WHERE p.kind='material' AND p.resolved_at IS NULL AND r.obra_id=? AND r.deleted_at IS NULL ORDER BY r.data LIMIT 50`).all(Number(scope.workId))
  }catch{return []}
 }
 /** Office decision: attach the phone diary of a day to the RDO already typed for it. */
 async linkFieldRdo(date,workId){
  const b=this.binding()
  if(!b)throw new Error('Ligue primeiro esta base à obra do celular.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new Error('Data inválida.')
  let target=this
  if(workId!=null&&Number(workId)!==Number(b.scope.workId)){
   const row=this.extraRows().find(item=>Number(item.work_id)===Number(workId))
   if(!row)throw new Error('Esta obra não possui vínculo ativo com o celular.')
   target=this.projectCoordinator(row)
  }
  const scope=target.binding()?.scope
  if(!scope||Number(scope.companyId)!==Number(b.scope.companyId)||scope.remoteCompanyId!==b.scope.remoteCompanyId||scope.deviceId!==b.scope.deviceId||scope.baseUrl!==b.scope.baseUrl)throw new Error('O vínculo da obra pertence a outra operação.')
  if(typeof this.dataProvider.linkFieldRdo!=='function')throw new Error('Esta fonte operacional não permite juntar diários.')
  const result=await resolved(this.dataProvider.linkFieldRdo(scope,String(date)))
  if(Array.isArray(target.fieldRdoIssues))target.fieldRdoIssues=target.fieldRdoIssues.filter(issue=>!(issue.code==='manual_rdo_exists'&&issue.date===date))
  target.fieldRdoRetryDates=[...new Set([...(target.fieldRdoRetryDates||[]),String(date)])]
  this.notify()
  this.run({retryNow:true}).catch(()=>{})
  return result
 }
 projectStates(){
  return this.extraRows().map(row=>{const scope=JSON.parse(row.binding),item=this.projectCoordinators?.get(row.id)
   return {id:row.id,workId:row.work_id,workName:scope.workName,remoteProjectId:row.remote_project_id,lastSyncAt:row.last_sync_at||null,lastError:row.last_error||null,
    pending:this.db.prepare("SELECT COUNT(*) n FROM desktop_sync_outbox WHERE scope_key=? AND status='pending'").get(this.key(scope)).n,
    conflicts:this.projectCoordinator(row).state().conflicts,
    fieldRdoIssues:Array.isArray(item?.fieldRdoIssues)?item.fieldRdoIssues.slice(0,10):[]}})
 }
 hasTable(name){try{return !!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)}catch{return false}}
 extraRows(){return this.hasTable('desktop_sync_extra_scopes')?this.db.prepare('SELECT * FROM desktop_sync_extra_scopes ORDER BY id').all():[]}
 /** Online access scoped to one project: every Desktop call carries projectId, validated by the Cloud. */
 projectOnline(projectId){
  const base=this.online,coordinator=this,proxy=Object.create(base)
  proxy.request=(route,payload,...rest)=>base.request.call(proxy,route,payload&&typeof payload==='object'&&!Array.isArray(payload)&&String(route).startsWith('/api/desktop/')?{...payload,projectId}:payload,...rest)
  proxy.session=async()=>{
   const session=await base.session(),list=await coordinator.authorizedProjects()
   const project=(list.projects||[]).find(item=>String(item.id)===String(projectId))
   if(!project)return {...session,authorized:false}
   return {...session,project:{id:project.id,name:project.name,companyId:session.company?.id},access:{...session.access,modules:project.modules||[]}}
  }
  return proxy
 }
 async authorizedProjects(force=false){
  if(typeof this.online.listAuthorizedProjects!=='function')return {projects:[],limits:null}
  const cached=this.projectListCache
  if(!force&&cached&&this.now()-cached.at<30000)return cached.value
  const value=await this.online.listAuthorizedProjects()
  this.projectListCache={at:this.now(),value}
  return value
 }
 projectCoordinator(row){
  this.projectCoordinators=this.projectCoordinators||new Map()
  let item=this.projectCoordinators.get(row.id)
  if(!item){item=new SyncCoordinator({database:this.database,online:this.projectOnline(row.remote_project_id),dataProvider:this.dataProvider,now:this.now,scopeRow:{table:'desktop_sync_extra_scopes',id:row.id}});this.projectCoordinators.set(row.id,item)}
  return item
 }
 async performProjects(options={}){
  const primary=this.binding()
  if(!primary||this.runtimeState().paused)return
  for(const row of this.extraRows()){
   try{await this.projectCoordinator(row).perform(options)}catch{/* recorded in the work's own last_error */}
  }
  try{await this.autoPublishWorks()}catch(error){this.projectIssue(String(error?.message||error))}
 }
 projectIssue(message){this.projectIssues=[{message:String(message).slice(0,300),at:new Date(this.now()).toISOString()}]}
 boundWorkIds(){const ids=new Set();const primary=this.binding();if(primary)ids.add(Number(primary.scope.workId));for(const row of this.extraRows())ids.add(Number(row.work_id));return ids}
 /** Lists online projects and local works so the office can publish every work once. */
 async listProjects(){
  const primary=this.binding()
  if(!primary)return {configured:false,projects:[],localWorks:[],limits:null}
  const list=await this.authorizedProjects(true),rows=this.extraRows()
  const boundRemote=new Map([[String(primary.scope.remoteProjectId),Number(primary.scope.workId)],...rows.map(row=>[String(row.remote_project_id),Number(row.work_id)])])
  const works=this.runtimeState().source==='local'?this.db.prepare('SELECT id,nome,empresa_id FROM obras WHERE empresa_id=? AND deleted_at IS NULL ORDER BY nome').all(primary.scope.companyId):[]
  const bound=this.boundWorkIds()
  return {configured:true,limits:list.limits||null,
   projects:(list.projects||[]).map(project=>({...project,localWorkId:boundRemote.get(String(project.id))??null})),
   localWorks:works.map(work=>({id:work.id,nome:work.nome,empresaId:work.empresa_id,bound:bound.has(Number(work.id))}))}
 }
 /** Office decision (or automatic for a brand-new work): bind a local work to an online project, creating it when needed. */
 async addProject({workId,remoteProjectId=''}={},requireCanonicalIdentity=false){
  const primary=this.binding()
  if(!primary)throw new Error('Ligue primeiro a obra principal ao celular.')
  if(!this.hasTable('desktop_sync_extra_scopes'))throw new Error('Atualize o Obra na Mão Desktop para publicar outras obras.')
  const id=Number(workId),work=this.db.prepare('SELECT id,nome,empresa_id FROM obras WHERE id=? AND deleted_at IS NULL').get(id)
  if(!work)throw new Error('Obra local não encontrada.')
  if(Number(work.empresa_id)!==Number(primary.scope.companyId))throw new Error('A obra local pertence a outra empresa.')
  if(this.runtimeState().source!=='local')throw new Error('A publicação adicional exige uma obra da base local.')
  const generation=this.generation
  await this.validate(primary.scope,generation)
  if(this.boundWorkIds().has(id))throw new Error('Esta obra já recebe dados do celular.')
  let project
  if(remoteProjectId){
   const list=await this.authorizedProjects(true)
   project=(list.projects||[]).find(item=>String(item.id)===String(remoteProjectId))
   if(!project)throw new Error('Obra online não autorizada para esta conta.')
   if(requireCanonicalIdentity&&(project.localWorkId!==id||(list.projects||[]).some(item=>item.localWorkId===id&&String(item.id)!==String(project.id))))throw new Error('A identidade canônica da obra online mudou.')
   if(project.localWorkId!=null&&Number(project.localWorkId)!==id)throw new Error('A obra online já identifica outra obra local.')
   if(String(primary.scope.remoteProjectId)===String(project.id)||this.extraRows().some(row=>row.remote_project_id===String(project.id)))throw new Error('Esta obra online já está ligada a outra obra local.')
  }else{
   if(typeof this.online.createProject!=='function')throw new Error('Criação de obra online indisponível nesta versão.')
   project=(await this.online.createProject({name:work.nome,localWorkId:id})).project
   this.projectListCache=null
  }
  this.assertScope(primary.scope,generation)
  const currentWork=this.db.prepare('SELECT empresa_id FROM obras WHERE id=? AND deleted_at IS NULL').get(id)
  if(Number(currentWork?.empresa_id)!==Number(primary.scope.companyId))throw new Error('A empresa da obra local mudou durante a publicação.')
  const company=this.db.prepare('SELECT razao_social,nome_fantasia FROM empresas WHERE id=?').get(work.empresa_id)||{}
  const scope={companyId:work.empresa_id,workId:id,companyName:company.nome_fantasia||company.razao_social||primary.scope.companyName,workName:work.nome,
   baseUrl:primary.scope.baseUrl,deviceId:primary.scope.deviceId,remoteCompanyId:primary.scope.remoteCompanyId,remoteProjectId:String(project.id),
   ...(primary.scope.storageMode?{storageMode:primary.scope.storageMode,serverId:primary.scope.serverId}:{})}
  this.db.prepare('INSERT INTO desktop_sync_extra_scopes(remote_project_id,work_id,binding) VALUES(?,?,?)').run(String(project.id),id,json(scope))
  this.notify()
  return {workId:id,remoteProjectId:String(project.id),name:project.name||work.nome}
 }
 /** New works created after this version are published automatically, within the license limit. */
 async autoPublishWorks(){
  if(this.runtimeState().source!=='local'||!this.hasTable('desktop_sync_settings')||typeof this.online.createProject!=='function')return
  const primary=this.binding();if(!primary)return
  await this.validate(primary.scope,this.generation)
  const {projects=[]}=await this.authorizedProjects(true)
  const claimedRemoteIds=new Set([String(primary.scope.remoteProjectId),...this.extraRows().map(row=>String(row.remote_project_id))])
  const evidence=new Map()
  for(const project of projects){
   if(!Number.isSafeInteger(project.localWorkId)||project.localWorkId<1)continue
   const matches=evidence.get(project.localWorkId)||new Set()
   matches.add(String(project.id))
   evidence.set(project.localWorkId,matches)
  }
  const existingWorks=this.db.prepare('SELECT id FROM obras WHERE empresa_id=? AND deleted_at IS NULL ORDER BY id').all(primary.scope.companyId)
  const boundBeforeRecovery=this.boundWorkIds()
  for(const {id} of existingWorks){
   const matches=evidence.get(id)
   if(boundBeforeRecovery.has(id)||!matches)continue
   if(matches.size!==1){this.projectIssue('Há mais de uma obra online para a mesma identidade local.');continue}
   const [remoteProjectId]=matches
   if(!claimedRemoteIds.has(remoteProjectId)){
    await this.addProject({workId:id,remoteProjectId},true)
    claimedRemoteIds.add(remoteProjectId)
   }
  }
  const setting=this.db.prepare("SELECT value FROM desktop_sync_settings WHERE key='auto_publish_after_work_id'").get()
  if(!setting){
   // Existing works without a canonical match remain available for manual publication.
   const max=this.db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM obras').get().id
   this.db.prepare("INSERT INTO desktop_sync_settings(key,value) VALUES('auto_publish_after_work_id',?)").run(String(max))
   return
  }
  const bound=this.boundWorkIds()
  const skip=this.hasTable('desktop_sync_skip_auto')?'AND id NOT IN (SELECT work_id FROM desktop_sync_skip_auto)':''
  const candidates=this.db.prepare(`SELECT id FROM obras WHERE id>? AND empresa_id=? AND deleted_at IS NULL ${skip} ORDER BY id`).all(Number(setting.value),Number(primary.scope.companyId)).filter(row=>!bound.has(Number(row.id))&&!evidence.has(Number(row.id)))
  for(const row of candidates){
   try{await this.addProject({workId:row.id})}
   catch(error){this.projectIssue(String(error?.message||error));break}
  }
 }
 async bootstrapBinding(){
  const runtime=this.runtimeState(), connection=this.online.state(), generation=this.generation
  if(runtime.paused || runtime.source!=='local' || !connection.linked || !this.online.readConfig)return
  try {
   const session=await this.online.session()
   if(session.authorized && session.role==='admin' && session.project && !session.project.workSource && this.online.fieldRdoCatalogOrigin){
    const result=await this.online.fieldRdoCatalogOrigin().catch(()=>null)
    if(result?.origin)session.project={...session.project,workSource:result.origin}
   }
   const current=this.online.state()
   if(generation!==this.generation || !current.linked || current.baseUrl!==connection.baseUrl || this.binding() || this.runtimeState().source!=='local')return
   this.online.assertAccountEmail?.(session.user?.email)
   this.db.transaction(()=>{
    const source=localRdoBinding(this.db,session,this.online.readConfig(),connection.baseUrl)
    if(!source){this.bootstrapReason='A obra online ainda não tem uma correspondência comprovada nesta base. Os dados locais estão preservados.';return}
    const scope={...source,companyName:session.company.name,workName:session.project.name,baseUrl:connection.baseUrl,deviceId:String(session.device.id),remoteCompanyId:String(session.company.id),remoteProjectId:String(session.project.id)}
    this.db.prepare('INSERT INTO desktop_sync_scope(id,binding,allowed_modules) VALUES(1,?,?)').run(json(scope),json(session.access?.modules||[]))
    this.bootstrapReason=null
   })()
  }catch(error){this.bootstrapReason='Não foi possível identificar a obra online. Nova tentativa automática: '+String(error.message)}
 }
 async perform({retryNow=false}={}){if(!this.binding()&&this.isPrimary)await this.bootstrapBinding();const b=this.binding();if(!b)return this.state();const runtime=this.runtimeState();if(runtime.paused)return this.state();const scope=b.scope,generation=this.generation;try{this.assertScope(scope,generation);if(runtime.source==='remote'){if(typeof this.online.claimRemoteSyncOwner!=='function')throw new Error('Autoridade de sincronização remota não configurada.');const serverId=String(this.dataProvider.storage?.state?.()?.serverId||'').trim();if(!serverId)throw new Error('Servidor próprio ainda não possui identidade válida para sincronização.');await this.online.claimRemoteSyncOwner(serverId)};await this.capture(scope,JSON.parse(b.allowed_modules||'[]'));const modules=await this.validate(scope,generation);this.db.prepare(`UPDATE ${this.scopeTable} SET allowed_modules=? WHERE id=?`).run(json(modules),this.scopeId);const plan=await this.capture(scope,modules);if(modules.includes('obra360')&&plan.bridgeEntities.length){const pull=await this.online.syncPull(b.remote_revision);this.assertScope(scope,generation);await this.ingest(scope,pull,plan.bridgeEntities)}if(modules.some(module=>module==='obra360'||module==='rdo'))await this.syncFieldRdos(scope,generation);
  const adminModules=modules.some(m=>['finance','rh','dre'].includes(m)),queue=this.db.prepare("SELECT * FROM desktop_sync_outbox WHERE scope_key=? AND status='pending' ORDER BY id").all(this.key(scope));for(const job of queue){this.assertScope(scope,generation);if(job.kind==='bridge'&&!modules.includes('obra360')){this.supersede(scope,job,'Módulo Obra360 não está mais liberado para este Desktop.');continue}if(job.kind==='bridge'&&!plan.bridgeEntities.includes(job.entity)){this.supersede(scope,job,'Entidade não disponível na fonte operacional atual.');continue}if(job.kind==='summary'&&!plan.summary){this.supersede(scope,job,'Resumo ainda não está disponível na fonte operacional atual.');continue}if(job.kind==='finance'&&!adminModules){this.supersede(scope,job,'Módulos administrativos não estão mais liberados para este Desktop.');continue}if(job.kind==='finance'&&!plan.obligations){this.supersede(scope,job,'Financeiro ainda não está disponível na fonte operacional atual.');continue}if(!retryNow&&job.next_attempt_at>this.now())continue;if(this.hasEarlierPending(scope,job))continue;if(this.db.prepare("SELECT id FROM desktop_sync_conflicts WHERE scope_key=? AND entity=? AND local_id=? AND status='open'").get(this.key(scope),job.entity,job.local_id))continue;
   try{const payload=JSON.parse(job.payload);let reply;if(job.kind==='bridge'){const head=this.db.prepare('SELECT remote_revision FROM desktop_sync_heads WHERE scope_key=? AND entity=? AND local_id=?').get(this.key(scope),job.entity,job.local_id);reply=await this.online.syncPush([{changeId:job.change_id,entity:job.entity,localId:job.local_id,baseMobileRevision:head?.remote_revision||0,payload}]);this.assertScope(scope,generation);const result=reply.accepted?.find(x=>x.changeId===job.change_id);if(!result)throw new Error('Servidor não confirmou a alteração.');if(result.conflict||result.status==='conflict'){this.conflict(scope,job.entity,job.local_id,payload,Number(result.currentMobileRevision||0),result.conflictId);continue}if(!['accepted','duplicate'].includes(result.status)||result.bridged===false)throw new Error('Alteração não aplicada à obra online.')}
    else if(job.kind==='summary'){reply=await this.online.publishMobileSummary({...payload,modules:Object.fromEntries(Object.entries(payload.modules||{}).filter(([key])=>modules.includes(key))),generatedAt:new Date(this.now()).toISOString()});if(!reply.ok)throw new Error('Resumo não confirmado.')}
    else {reply=await this.online.publishFinanceReference([payload]);if(reply.accepted!==1)throw new Error('Obrigação não confirmada.')}
    this.assertScope(scope,generation);this.db.transaction(()=>{this.db.prepare("UPDATE desktop_sync_outbox SET status='sent',last_error=NULL WHERE id=?").run(job.id);this.db.prepare('UPDATE desktop_sync_heads SET acknowledged_hash=? WHERE scope_key=? AND entity=? AND local_id=?').run(job.payload_hash,this.key(scope),job.entity,job.local_id)})()
   }catch(error){this.db.prepare('UPDATE desktop_sync_outbox SET attempts=attempts+1,next_attempt_at=?,last_error=? WHERE id=?').run(this.now()+Math.min(3600000,15000*2**Math.min(job.attempts,8)),String(error.message),job.id);throw error}
  }
  this.assertScope(scope,generation);this.db.prepare(`UPDATE ${this.scopeTable} SET last_sync_at=?,last_error=NULL WHERE id=?`).run(new Date(this.now()).toISOString(),this.scopeId)
 }catch(error){if(this.db?.open)this.db.prepare(`UPDATE ${this.scopeTable} SET last_error=? WHERE id=?`).run(String(error.message),this.scopeId);throw error}return this.state()}
 async resolveLocalConflict(id,resolution){if(this.running)throw new Error('Aguarde a sincronização atual terminar.');
  if(this.isPrimary){
   const primary=this.binding()?.scope
   const conflict=this.db.prepare("SELECT scope_key FROM desktop_sync_conflicts WHERE id=? AND status='open'").get(Number(id))
   if(primary&&conflict&&conflict.scope_key!==this.key(primary)){
    const row=this.extraRows().find(item=>{
     const scope=JSON.parse(item.binding)
     return this.key(scope)===conflict.scope_key&&scope.companyId===primary.companyId&&scope.remoteCompanyId===primary.remoteCompanyId&&scope.deviceId===primary.deviceId&&scope.baseUrl===primary.baseUrl
    })
    if(!row)throw new Error('Conflito não encontrado no vínculo atual.')
    await this.projectCoordinator(row).resolveLocalConflict(id,resolution)
    return this.notify()
   }
  }if(!['keep_local','accept_remote'].includes(resolution))throw new Error('Resolução inválida.');const runtime=this.runtimeState();if(runtime.paused)throw new Error(`Sincronização pausada: ${runtime.pauseReason}`);if(runtime.source==='remote'){if(typeof this.online.claimRemoteSyncOwner!=='function')throw new Error('Autoridade de sincronização remota não configurada.');const serverId=String(this.dataProvider.storage?.state?.()?.serverId||'').trim();if(!serverId)throw new Error('Servidor próprio ainda não possui identidade válida para sincronização.');await this.online.claimRemoteSyncOwner(serverId)};const scope=this.binding()?.scope;if(!scope)throw new Error('Configure a sincronização.');const generation=this.generation;await this.validate(scope,generation);const conflict=this.db.prepare("SELECT * FROM desktop_sync_conflicts WHERE id=? AND scope_key=? AND status='open'").get(Number(id),this.key(scope));if(!conflict)throw new Error('Conflito não encontrado.');const pull=await this.online.syncPull(0);this.assertScope(scope,generation);const item=(pull.snapshot?.desktopBridge?.[BRIDGE[conflict.entity]]||[]).find(x=>String(x.sourceDeviceId)===scope.deviceId&&Number(x.localId)===conflict.local_id);if(!item)throw new Error('Registro remoto não encontrado; revise o vínculo antes de resolver.');if(Number(item.mobileEditedRevision||0)!==conflict.remote_revision){this.conflict(scope,conflict.entity,conflict.local_id,item.payload||{},Number(item.mobileEditedRevision||0),conflict.remote_conflict_id);throw new Error('O registro online mudou; atualize e revise o conflito novamente.');}if(conflict.remote_conflict_id){
   const result=await this.online.resolveConflict(conflict.remote_conflict_id,'keep_mobile');this.assertScope(scope,generation);if(result?.ok===false)throw new Error('Conflito online não confirmado.')}
  if(resolution==='accept_remote'&&!await resolved(this.applyRemote(scope,conflict.entity,conflict.local_id,item.payload)))throw new Error('Registro local ausente.')
  const row=await resolved(this.dataProvider.getBridge(conflict.entity,conflict.local_id,scope));if(!row)throw new Error('Registro local ausente.');const digest=hash(payloadOf(row));
  this.db.transaction(()=>{this.db.prepare("UPDATE desktop_sync_outbox SET status='superseded' WHERE scope_key=? AND entity=? AND local_id=? AND status='pending'").run(this.key(scope),conflict.entity,conflict.local_id);this.db.prepare("UPDATE desktop_sync_conflicts SET status=? WHERE id=?").run(resolution,id);this.db.prepare('UPDATE desktop_sync_heads SET captured_hash=?,acknowledged_hash=?,remote_revision=? WHERE scope_key=? AND entity=? AND local_id=?').run(resolution==='accept_remote'?digest:'',resolution==='accept_remote'?digest:null,Number(item.mobileEditedRevision||0),this.key(scope),conflict.entity,conflict.local_id)})();return this.notify()
 }
}
module.exports={SyncCoordinator}
