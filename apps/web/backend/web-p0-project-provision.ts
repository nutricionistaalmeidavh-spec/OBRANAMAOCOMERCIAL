import {db,runtimeEnv} from '../cloudflare/sdk';
import {getProject, getMeta, saveSnapshot, type ProjectRecord} from './project-state';

/** Stable ID: retry after a Cloudflare failure must not make a second project. */
export function p0ProjectId(commandId:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))
    throw new Error('Comando de criação de obra inválido.');
  return 'p0work_'+commandId.replace(/-/g,'').toLowerCase();
}
export type P0WorkSource={sourceDeviceId:string;localWorkId:number;parentProjectId:string};
export type P0Project=ProjectRecord&{workSource:P0WorkSource};
export async function ensureP0WorkProject(input:{
  commandId:string;companyId:string;parentProjectId:string;actorId:string;
  sourceDeviceId:string;localWorkId:number;name:string;customer?:string;
  maxProjects:number
}){
  if(!Number.isSafeInteger(input.localWorkId)||input.localWorkId<1)throw new Error('ID canônico da obra inválido.');
  const parent=await getProject(input.parentProjectId);
  if(!parent||parent.companyId!==input.companyId)throw new Error('Projeto de origem não pertence à empresa.');
  const id=p0ProjectId(input.commandId),stamp=new Date().toISOString();
  const workSource:P0WorkSource={sourceDeviceId:input.sourceDeviceId,localWorkId:input.localWorkId,parentProjectId:input.parentProjectId};
  const record:P0Project={companyId:input.companyId,name:input.name,customer:input.customer||undefined,createdAt:stamp,createdBy:input.actorId,workSource};
  // CAS-like bounded insert: no duplicate project and no breach of license maximum.
  await runtimeEnv().DB.prepare(
    "INSERT OR IGNORE INTO kv_records(collection,id,record_json,created_at,updated_at) "+
    "SELECT 'projects',?,?,?,? WHERE "+
    "(SELECT COUNT(*) FROM kv_records WHERE collection='projects' AND json_extract(record_json,'$.companyId')=?) < ?"
  ).bind(id,JSON.stringify(record),stamp,stamp,input.companyId,input.maxProjects).run();
  const existing=await getProject(id) as P0Project|null;
  if(!existing)throw new Error('Limite de projetos atingido; vinculação automática pendente.');
  if(existing.companyId!==input.companyId||
      existing.workSource?.sourceDeviceId!==input.sourceDeviceId||
      existing.workSource?.localWorkId!==input.localWorkId||
      existing.workSource?.parentProjectId!==input.parentProjectId)
    throw new Error('Conflito: obra canônica já vinculada a outro projeto.');
  if(!await getMeta(id)){
    await saveSnapshot(id,{project:{name:existing.name,customer:existing.customer||''},floors:[],employees:[],days:{}},input.actorId,{allowUnversioned:true});
  }
  return{id,project:existing};
}
