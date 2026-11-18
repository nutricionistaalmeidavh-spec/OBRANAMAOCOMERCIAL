const { createHash }=require('node:crypto')
const ALLOWED={
 empresas:new Set(['razao_social','nome_fantasia','cnpj','telefone','email','endereco','observacoes','status']),
 clientes:new Set(['nome','documento','telefone','email','observacoes']),
 obras:new Set(['nome','codigo','endereco','responsavel','cliente_id','data_inicio','previsao_termino','status','observacoes']),
 frentes_obra:new Set(['nome','codigo','ordem','status','observacoes']),
 subfrentes_obra:new Set(['nome','codigo','pavimento','escopo','ordem','status','observacoes','frente_id']),
 tarefas_obra:new Set(['titulo','descricao','responsavel','prazo','prioridade','status','frente_id']),
 etapas_obra:new Set(['nome','frente_id','ordem','status']),
 cronograma_etapas:new Set(['nome','frente_id','etapa_id','responsavel','previsto_inicio','previsto_fim','percentual_previsto','percentual_realizado','status','observacoes'])
}
class WebP0CommandError extends Error{
 constructor(message){super(message);this.name='WebP0CommandError';this.code='invalid_web_p0_command'}
}
const reject=message=>{throw new WebP0CommandError(message)}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
const owned=(entity,row,scope)=>entity==='empresas'?Number(row.id)===Number(scope.companyId):entity==='obras'||entity==='clientes'
 ?Number(row.empresa_id)===Number(scope.companyId)
 :Number(row.obra_id)===Number(scope.workId)
function webP0Fingerprint(row){
 const fields=Object.fromEntries(Object.entries({...row,deleted:!!row.deleted_at})
  .filter(([key])=>!['created_at','updated_at'].includes(key))
  .sort(([left],[right])=>left.localeCompare(right)))
 return digest(fields)
}
function dependents(db,entity,id){
 const name=v=>'"'+String(v).replace(/"/g,'""')+'"'
 for(const tableRow of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
  const table=tableRow.name
  for(const fk of db.prepare('PRAGMA foreign_key_list('+name(table)+')').all().filter(fk=>fk.table===entity)){
   const columns=db.prepare('PRAGMA table_info('+name(table)+')').all().map(x=>x.name)
   const live=columns.includes('deleted_at')?' AND deleted_at IS NULL':''
   if(db.prepare('SELECT 1 FROM '+name(table)+' WHERE '+name(fk.from)+'=?'+live+' LIMIT 1').get(id))
    return table+' ('+fk.from+')'
  }
 }
 return null
}
function applyWebP0Create({database,scope,command}){
 const entity=String(command?.entity||''),action=String(command?.action||'create')
 const allowed=ALLOWED[entity],data=command?.data||{}
 if(!allowed||!['create','update','delete'].includes(action)||!data||typeof data!=='object'||Array.isArray(data))reject('Entidade, operação ou dados não autorizados.')
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(command?.id||'')))reject('ID do comando inválido.')
 if(String(command?.deviceId||'')!==String(scope.deviceId||''))reject('O comando não pertence ao Desktop autenticado.')
 const clean={}
 if(entity==='empresas'&&action!=='update')reject('Empresa vinculada à licença não pode ser criada/excluída via comando operacional.')
 if(action!=='delete'){
  for(const [key,value] of Object.entries(data)){
   if(!allowed.has(key))reject('Campo não permitido: '+key)
   if(['frente_id','cliente_id','etapa_id','ordem'].includes(key)){
    if(!Number.isSafeInteger(value)||value<(key==='ordem'?0:1)||value>100000000)reject('Referência numérica inválida.')
    clean[key]=value;continue
   }
   if(['percentual_previsto','percentual_realizado'].includes(key)){
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)reject('Percentual fora da faixa permitida.')
    clean[key]=value;continue
   }
   if(typeof value!=='string'||value.length>(['nome','titulo'].includes(key)?250:['descricao','observacoes'].includes(key)?4000:255))reject('Campo inválido: '+key)
   clean[key]=value.trim()
   if(['prazo','data_inicio','previsao_termino','previsto_inicio','previsto_fim'].includes(key)&&clean[key]&&!validDate(clean[key]))reject('Data inválida.')
  }
  if(!Object.keys(clean).length)reject('Informe campos para alterar.')
  if(action==='create'&&!String(clean[entity==='tarefas_obra'?'titulo':entity==='empresas'?'razao_social':'nome']||'').trim())reject('Informe nome ou título.')
  if(action==='update'&&['nome','razao_social','titulo'].some(k=>Object.hasOwn(clean,k)&&!clean[k]))reject('Nome ou título não pode ficar vazio.')
  if(action==='update'&&(!Number.isSafeInteger(command.localId)||command.localId<1||!(/^[a-f0-9]{64}$/i.test(String(command.expectedFingerprint||'')))))reject('Edição exige ID e versão canônica.')
  if(action==='create'&&entity==='subfrentes_obra'&&!Number.isSafeInteger(clean.frente_id))reject('Informe a etapa da subetapa.')
 }else{
  if(Object.keys(data).length||!Number.isSafeInteger(command.localId)||command.localId<1
   ||typeof command.expectedFingerprint!=='string'||!/^[a-f0-9]{64}$/i.test(command.expectedFingerprint))
   reject('Exclusão exige ID e hash canônico da versão recebida.')
 }
 const companyId=Number(scope.companyId),obraId=Number(scope.workId)
 if(!Number.isSafeInteger(companyId)||!Number.isSafeInteger(obraId)||companyId<=0||obraId<=0)reject('Escopo operacional inválido.')
 const db=database.db,localId=Number(command.localId||0)
 const payloadHash=digest({action,entity,data:clean,localId,expectedFingerprint:command.expectedFingerprint||'',deviceId:String(scope.deviceId),companyId,obraId})
 return db.transaction(()=>{
  const previous=db.prepare('SELECT * FROM web_p0_command_receipts WHERE command_id=?').get(command.id)
  if(previous){
   if(previous.payload_hash!==payloadHash||previous.empresa_id!==companyId||previous.obra_id!==obraId||previous.device_id!==scope.deviceId)reject('Comando já utilizado com outro cadastro ou outra obra.')
   return{entity,action,localId:previous.local_id,duplicate:true}
  }
  const company=database.get('empresas',companyId),work=database.get('obras',obraId)
  if(!company||company.deleted_at||!work||work.deleted_at||Number(work.empresa_id)!==companyId)reject('Empresa ou obra do vínculo operacional não autorizada.')
  let savedId
  if(action==='delete'||action==='update'){
   const current=database.get(entity,localId)
   if(!current||current.deleted_at||!owned(entity,current,scope))reject('Cadastro não existe ou não pertence ao escopo autorizado.')
   if(action==='delete'&&entity==='obras'&&localId===obraId)reject('A obra conectada não pode ser excluída durante a sincronização.')
   if(webP0Fingerprint(current)!==String(command.expectedFingerprint).toLowerCase())reject('Registro mudou desde a leitura Web. Atualize antes de tentar novamente.')
   if(action==='delete'){
    const child=dependents(db,entity,localId)
    if(child)reject('Cadastro possui dependência ativa: '+child)
    if(!database.remove(entity,localId))reject('Exclusão lógica não foi confirmada pelo banco.')
   }else{
    if(clean.frente_id!=null){const stage=database.get('frentes_obra',clean.frente_id);if(!stage||stage.deleted_at||Number(stage.obra_id)!==obraId)reject('Etapa de outra obra.')}
    if(clean.etapa_id!=null){const plan=database.get('etapas_obra',clean.etapa_id);if(!plan||plan.deleted_at||Number(plan.obra_id)!==obraId)reject('Etapa do planejamento pertence a outra obra.')}
    if(clean.cliente_id!=null){const customer=database.get('clientes',clean.cliente_id);if(!customer||customer.deleted_at||Number(customer.empresa_id)!==companyId)reject('Cliente de outra empresa.')}
    if(!database.save(entity,{...clean,id:localId}))reject('Alteração não confirmada no SQLite.')
   }
   savedId=localId
  }else{
   if(clean.frente_id!=null){
    const stage=database.get('frentes_obra',clean.frente_id)
    if(!stage||stage.deleted_at||Number(stage.obra_id)!==obraId)reject('Etapa vinculada pertence a outra obra.')
   }
   if(clean.etapa_id!=null){
    const plan=database.get('etapas_obra',clean.etapa_id)
    if(!plan||plan.deleted_at||Number(plan.obra_id)!==obraId)reject('Etapa do planejamento pertence a outra obra.')
   }
   if(clean.cliente_id!=null){
    const client=database.get('clientes',clean.cliente_id)
    if(!client||client.deleted_at||Number(client.empresa_id)!==companyId)reject('Cliente não pertence à empresa autorizada.')
   }
   const fields=entity==='clientes'||entity==='obras'
    ?{...clean,empresa_id:companyId}
    :{...clean,obra_id:obraId}
   const saved=database.save(entity,fields)
   if(!saved?.id)throw new Error('Banco operacional não confirmou o cadastro.')
   savedId=Number(saved.id)
  }
  db.prepare('INSERT INTO web_p0_command_receipts(command_id,device_id,empresa_id,obra_id,entity,payload_hash,local_id) VALUES(?,?,?,?,?,?,?)')
   .run(command.id,String(scope.deviceId),companyId,obraId,entity,payloadHash,savedId)
  database.audit?.(entity,savedId,action==='delete'?'WEB_P0_DELETED':action==='update'?'WEB_P0_UPDATED':'WEB_P0_CREATED',{commandId:command.id})
  return{entity,action,localId:savedId,duplicate:false}
 })()
}
module.exports={applyWebP0Create,WebP0CommandError,webP0Fingerprint}
