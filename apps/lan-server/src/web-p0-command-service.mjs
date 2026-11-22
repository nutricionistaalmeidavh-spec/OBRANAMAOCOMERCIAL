import {createHash} from 'node:crypto';
import {applyLanWebP1} from './web-p1-domain.mjs';
import {applyLanP1Document} from './web-p1-document.mjs';

const FIELDS={
 empresas:new Set(['razao_social','nome_fantasia','cnpj','telefone','email','endereco','observacoes','status']),
 clientes:new Set(['nome','documento','telefone','email','observacoes']),
 obras:new Set(['nome','codigo','endereco','responsavel','cliente_id','data_inicio','previsao_termino','status','observacoes']),
 frentes_obra:new Set(['nome','codigo','ordem','status','observacoes']),
 subfrentes_obra:new Set(['nome','codigo','pavimento','escopo','ordem','status','observacoes','frente_id']),
 tarefas_obra:new Set(['titulo','descricao','responsavel','prazo','prioridade','status','frente_id']),
 etapas_obra:new Set(['nome','frente_id','ordem','status']),
 cronograma_etapas:new Set(['nome','frente_id','etapa_id','responsavel','previsto_inicio','previsto_fim','percentual_previsto','percentual_realizado','status','observacoes']),
 checklist_frente_itens:new Set(['frente_id','subfrente_id','descricao','tipo','status','responsavel','prazo','observacoes','pavimento']),
 rdos:new Set(['data','clima','atividades','observacoes']),
 itens_orcamentarios:new Set(['descricao','codigo','unidade','tipo','quantidade','valor_unitario_centavos','frente_id','etapa_id','observacoes']),
 solicitacoes_compra:new Set(['descricao','solicitante','prazo','prioridade','observacoes','frente_id','etapa_id'])
};
export class WebP0CommandError extends Error{
 constructor(message){super(message);this.name='WebP0CommandError';this.code='invalid_web_p0_command'}
}
const reject=message=>{throw new WebP0CommandError(message)};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function webP0Fingerprint(row){
 const payload=Object.fromEntries(Object.entries({...row,deleted:!!row.deleted_at})
  .filter(([k])=>!['created_at','updated_at'].includes(k))
  .sort(([a],[b])=>a.localeCompare(b)));
 return hash(payload);
}
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const owned=(entity,row,scope)=>entity==='empresas'?Number(row.id)===Number(scope.companyId):Number(entity==='obras'||entity==='clientes'?row.empresa_id:row.obra_id)===Number(entity==='obras'||entity==='clientes'?scope.companyId:scope.workId);
const quote=s=>'"'+String(s).replace(/"/g,'""')+'"';
function dependent(db,table,id){
 for(const entry of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
  for(const fk of db.prepare('PRAGMA foreign_key_list('+quote(entry.name)+')').all()){
   if(fk.table!==table)continue;
   const columns=db.prepare('PRAGMA table_info('+quote(entry.name)+')').all().map(c=>c.name);
   const condition=columns.includes('deleted_at')?' AND deleted_at IS NULL':'';
   if(db.prepare('SELECT 1 FROM '+quote(entry.name)+' WHERE '+quote(fk.from)+'=?'+condition+' LIMIT 1').get(id))
    return entry.name+' ('+fk.from+')';
  }
 }
 return null;
}
function validateCommand(command){
 const entity=String(command?.entity||''),action=String(command?.action||'create'),fields=FIELDS[entity];
 if(!fields||!['create','update','delete'].includes(action)||!command||typeof command!=='object')reject('Cadastro ou operação não permitida.');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(command.id||'')))reject('Comando sem UUID válido.');
 if(['rdos','checklist_frente_itens','itens_orcamentarios','solicitacoes_compra'].includes(entity)&&action!=='create')reject('Use a edição canônica com revisões para este registro.');
 if(entity==='empresas'&&action!=='update')reject('Nova empresa requer tenant e licença independentes.');
 const data=command.data||{};
 if(!data||typeof data!=='object'||Array.isArray(data))reject('Dados inválidos.');
 const clean={};
 if(action==='delete'){
  if(!Number.isSafeInteger(command.localId)||command.localId<1||!/^[a-f0-9]{64}$/i.test(String(command.expectedFingerprint||''))||Object.keys(data).length)reject('Exclusão sem ID ou hash da versão canônica.');
 }else{
  if(action==='update'&&(!Number.isSafeInteger(command.localId)||command.localId<1||!/^[a-f0-9]{64}$/i.test(String(command.expectedFingerprint||''))))reject('Edição exige ID e hash da fonte.');
  for(const [key,v] of Object.entries(data)){
   if(!fields.has(key))reject('Campo não permitido: '+key);
   if(action==='update'&&key==='cliente_id'&&v===null){clean[key]=null;continue;}
   if(['cliente_id','frente_id','etapa_id','subfrente_id','ordem'].includes(key)){
    if(!Number.isSafeInteger(v)||v<(key==='ordem'?0:1)||v>100000000)reject('Referência inválida.');
    clean[key]=v;continue;
   }
   if(key==='quantidade'){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000000)reject('Quantidade inválida.');clean[key]=v;continue;}
   if(key==='valor_unitario_centavos'){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>100000000000)reject('Valor unitário inválido.');clean[key]=v;continue;}
   if(key==='tipo'&&entity==='itens_orcamentarios'&&!['material','mao_de_obra','equipamento','servico'].includes(v))reject('Tipo orçamentário inválido.');
   if(['percentual_previsto','percentual_realizado'].includes(key)){
    if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)reject('Percentual fora da faixa permitida.');
    clean[key]=v;continue;
   }
   if(typeof v!=='string'||v.length>(['nome','titulo','descricao'].includes(key)?250:['atividades','observacoes'].includes(key)?4000:255))reject('Campo inválido: '+key);
   clean[key]=v.trim();
   if(['prazo','data','data_inicio','previsao_termino','previsto_inicio','previsto_fim'].includes(key)&&clean[key]&&!validDate(clean[key]))reject('Data inválida.');
  }
  if(!Object.keys(clean).length)reject('Informe campos para salvar.');
  if(action==='create'&&!String(clean[entity==='tarefas_obra'?'titulo':entity==='empresas'?'razao_social':['checklist_frente_itens','itens_orcamentarios','solicitacoes_compra'].includes(entity)?'descricao':entity==='rdos'?'data':'nome']||'').trim())reject('Informe nome/descrição/data.');
  if(action==='create'&&entity==='checklist_frente_itens'&&!Number.isSafeInteger(clean.frente_id))reject('Checklist exige etapa da obra.');
  if(action==='create'&&entity==='itens_orcamentarios'&&(!clean.unidade||!clean.tipo||typeof clean.quantidade!=='number'||typeof clean.valor_unitario_centavos!=='number'))reject('Orçamento exige unidade, tipo, quantidade e valor.');
  if(action==='create'&&entity==='solicitacoes_compra'&&!clean.solicitante)reject('Solicitante obrigatório.');
  if(action==='update'&&['nome','razao_social','titulo'].some(k=>Object.hasOwn(clean,k)&&!clean[k]))reject('Nome ou título não pode ficar vazio.');
  if(action==='create'&&entity==='subfrentes_obra'&&!Number.isSafeInteger(clean.frente_id))reject('Informe etapa.');
 }
 return{entity,action,clean};
}
export function applyLanWebP0Command({repository,versionedRepository,scope,command,documents}){
 if(String(command?.entity||'')==='documentos')return applyLanP1Document({repository,scope,command,documents});
 if(['medicoes','pedidos_compra','recebimentos_materiais','movimentacoes_estoque','contratos_obra','contrato_aditivos'].includes(String(command?.entity||'')))return applyLanWebP1({repository,scope,command});
 const db=repository?.connection?.();
 if(!db?.prepare||!db?.exec)throw new WebP0CommandError('Fonte central indisponível.');
 const companyId=Number(scope.companyId),workId=Number(scope.workId);
 if(!Number.isSafeInteger(companyId)||companyId<1||!Number.isSafeInteger(workId)||workId<1)reject('Escopo da empresa/obra inválido.');
 const {entity,action,clean}=validateCommand(command),id=Number(command.localId||0);
 const digest=hash({action,entity,data:clean,localId:id,expectedFingerprint:command.expectedFingerprint||'',deviceId:String(scope.deviceId),companyId,obraId:workId});
 db.exec('BEGIN IMMEDIATE');
 try{
  const old=db.prepare('SELECT * FROM web_p0_command_receipts WHERE command_id=?').get(command.id);
  if(old){
   if(old.payload_hash!==digest||old.empresa_id!==companyId||old.obra_id!==workId||old.device_id!==scope.deviceId)reject('UUID já utilizado para outro comando.');
   db.exec('COMMIT');
   return{entity,action,localId:old.local_id,duplicate:true};
  }
  const company=repository.get('empresas',companyId),work=repository.get('obras',workId);
  if(!company||company.deleted_at||!work||work.deleted_at||Number(work.empresa_id)!==companyId)reject('Empresa/obra incompatível com o contexto.');
  let savedId;
  if(action==='delete'||action==='update'){
   const row=repository.get(entity,id);
   if(!row||row.deleted_at||!owned(entity,row,scope))reject('Cadastro inexistente ou fora da empresa/obra.');
   if(action==='delete'&&entity==='obras'&&id===workId)reject('Obra em uso pela sincronização não pode ser excluída.');
   const revisioned=versionedRepository?.decorate(entity,row)||row;
   if(webP0Fingerprint(revisioned)!==String(command.expectedFingerprint).toLowerCase())reject('Cadastro modificado após a última sincronização.');
   if(action==='delete'){
    const child=dependent(db,entity,id);
    if(child)reject('Cadastro possui dependência ativa: '+child);
    if(!repository.remove(entity,id))reject('Exclusão lógica falhou.');
    versionedRepository?.concurrency?.remove(entity,id);
   }else{
    if(clean.frente_id!=null){const stage=repository.get('frentes_obra',clean.frente_id);if(!stage||stage.deleted_at||Number(stage.obra_id)!==workId)reject('Etapa de outra obra.');}
    if(clean.etapa_id!=null){const plan=repository.get('etapas_obra',clean.etapa_id);if(!plan||plan.deleted_at||Number(plan.obra_id)!==workId)reject('Etapa do planejamento de outra obra.');}
    if(clean.cliente_id!=null){const client=repository.get('clientes',clean.cliente_id);if(!client||client.deleted_at||Number(client.empresa_id)!==companyId)reject('Cliente de outra empresa.');}
    if(!repository.save(entity,{...clean,id}))reject('Alteração não confirmada no SQLite.');
    versionedRepository?.concurrency?.bump(entity,id);
   }
   savedId=id;
  }else{
   if(clean.frente_id!=null){const stage=repository.get('frentes_obra',clean.frente_id);if(!stage||stage.deleted_at||Number(stage.obra_id)!==workId)reject('Etapa pertence a outra obra.');}
   if(clean.cliente_id!=null){const client=repository.get('clientes',clean.cliente_id);if(!client||client.deleted_at||Number(client.empresa_id)!==companyId)reject('Cliente pertence a outra empresa.');}
   if(clean.subfrente_id!=null){const sub=repository.get('subfrentes_obra',clean.subfrente_id);if(!sub||sub.deleted_at||Number(sub.obra_id)!==workId||Number(sub.frente_id)!==Number(clean.frente_id))reject('Subetapa não corresponde à etapa/obra.');}
   if(entity==='rdos'&&db.prepare('SELECT id FROM rdos WHERE obra_id=? AND data=? AND deleted_at IS NULL LIMIT 1').get(workId,clean.data))reject('Já existe RDO nesta data da obra.');
   if(clean.etapa_id!=null){const plan=repository.get('etapas_obra',clean.etapa_id);if(!plan||plan.deleted_at||Number(plan.obra_id)!==workId)reject('Etapa do planejamento pertence a outra obra.');}
   const data=entity==='clientes'||entity==='obras'?{...clean,empresa_id:companyId}:{...clean,obra_id:workId};
   const saved=repository.save(entity,data);
   if(!saved?.id)reject('Banco central não confirmou o registro.');
   versionedRepository?.concurrency?.initialize(entity,saved.id);
   savedId=saved.id;
  }
  db.prepare('INSERT INTO web_p0_command_receipts(command_id,device_id,empresa_id,obra_id,entity,payload_hash,local_id) VALUES(?,?,?,?,?,?,?)')
    .run(command.id,String(scope.deviceId),companyId,workId,entity,digest,savedId);
  db.exec('COMMIT');
  return{entity,action,localId:savedId,duplicate:false};
 }catch(e){try{db.exec('ROLLBACK')}catch{}throw e}
}
