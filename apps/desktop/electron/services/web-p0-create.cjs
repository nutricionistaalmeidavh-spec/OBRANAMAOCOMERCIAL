const { createHash }=require('node:crypto')
const ALLOWED={
 frentes_obra:new Set(['nome','codigo','ordem','status','observacoes']),
 subfrentes_obra:new Set(['nome','codigo','pavimento','escopo','ordem','status','observacoes','frente_id']),
 tarefas_obra:new Set(['titulo','descricao','responsavel','prazo','prioridade','status','frente_id'])
}
class WebP0CommandError extends Error {
 constructor(message){super(message);this.name='WebP0CommandError';this.code='invalid_web_p0_command'}
}
const reject=(message)=>{throw new WebP0CommandError(message)}
const digest=(value)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value

function applyWebP0Create({database,scope,command}){
 const entity=String(command?.entity||''),allowed=ALLOWED[entity],data=command?.data
 if(!allowed||!data||typeof data!=='object'||Array.isArray(data))reject('Entidade ou dados do cadastro não autorizados.')
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(command?.id||'')))reject('ID do comando inválido.')
 if(String(command?.deviceId||'')!==String(scope.deviceId||''))reject('O comando não pertence ao Desktop autenticado.')
 const clean={};
 for(const [key,value] of Object.entries(data)){
  if(!allowed.has(key))reject('Campo não permitido: '+key)
  if(key==='frente_id'||key==='ordem'){
   if(!Number.isSafeInteger(value)||value<(key==='frente_id'?1:0)||value>100000000)reject('Referência numérica inválida.')
   clean[key]=value;continue
  }
  if(typeof value!=='string'||value.length>(['nome','titulo'].includes(key)?250:['descricao','observacoes'].includes(key)?4000:255))reject('Campo inválido: '+key)
  clean[key]=value.trim()
  if(key==='prazo'&&clean[key]&&!validDate(clean[key]))reject('Prazo inválido.')
 }
 if(!Object.keys(clean).length||!String(clean[entity==='tarefas_obra'?'titulo':'nome']||'').trim())reject('Informe nome ou título.')
 if(entity==='subfrentes_obra'&&!Number.isSafeInteger(clean.frente_id))reject('Informe a etapa da subetapa.')
 const companyId=Number(scope.companyId),obraId=Number(scope.workId)
 if(!Number.isSafeInteger(companyId)||!Number.isSafeInteger(obraId)||companyId<=0||obraId<=0)reject('Escopo operacional inválido.')
 const databaseDb=database.db,payloadHash=digest({entity,data:clean,deviceId:String(scope.deviceId),companyId,obraId})
 return databaseDb.transaction(()=>{
  const previous=databaseDb.prepare('SELECT * FROM web_p0_command_receipts WHERE command_id=?').get(command.id)
  if(previous){
   if(previous.payload_hash!==payloadHash||previous.empresa_id!==companyId||previous.obra_id!==obraId||previous.device_id!==scope.deviceId)reject('Comando já utilizado com outro cadastro ou outra obra.')
   return{entity,localId:previous.local_id,duplicate:true}
  }
  const work=database.get('obras',obraId)
  if(!work||work.deleted_at||Number(work.empresa_id)!==companyId)reject('Obra não pertence à empresa autorizada.')
  if(clean.frente_id!=null){
   const stage=database.get('frentes_obra',clean.frente_id)
   if(!stage||stage.deleted_at||Number(stage.obra_id)!==obraId)reject('A etapa escolhida não pertence a esta obra.')
  }
  const saved=database.save(entity,{...clean,obra_id:obraId})
  if(!saved?.id)throw new Error('Banco operacional não confirmou o cadastro.')
  databaseDb.prepare('INSERT INTO web_p0_command_receipts(command_id,device_id,empresa_id,obra_id,entity,payload_hash,local_id) VALUES(?,?,?,?,?,?,?)')
   .run(command.id,String(scope.deviceId),companyId,obraId,entity,payloadHash,Number(saved.id))
  database.audit?.(entity,Number(saved.id),'WEB_P0_CREATED',{commandId:command.id})
  return{entity,localId:Number(saved.id),duplicate:false}
 })()
}
module.exports={applyWebP0Create,WebP0CommandError}
