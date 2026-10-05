import {db,runtimeEnv} from '../cloudflare/sdk';

export type CompanyStorageMode='local-single'|'lan-server'|'remote';
export type CompanyStorageTopology={mode:CompanyStorageMode;serverId?:string|null;updatedAt?:string;updatedByDeviceId?:string|null};
export type DesktopStorageBinding={mode:'lan-server'|'remote';serverId:string;autoEnroll:true};

const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
const table=(companyId:string)=>`company_storage_${safe(String(companyId||''))}`;
const validServerId=(value:string)=>value.length>=8&&value.length<=128&&/^[A-Za-z0-9._:-]+$/.test(value);

export function normalizeCompanyStorageTopology(input:Partial<CompanyStorageTopology>|null|undefined):CompanyStorageTopology{
  const mode=String(input?.mode||'local-single') as CompanyStorageMode;
  if(!['local-single','lan-server','remote'].includes(mode))throw new Error('Modo de armazenamento da empresa inválido.');
  const serverId=String(input?.serverId||'').trim();
  if((mode==='lan-server'||mode==='remote')&&!validServerId(serverId))throw new Error('O servidor da empresa precisa possuir uma identidade estável válida.');
  return{mode,serverId:mode==='local-single'?null:serverId,updatedAt:input?.updatedAt,updatedByDeviceId:input?.updatedByDeviceId??null};
}

export function desktopBindingForMember(topology:CompanyStorageTopology,channels:string[]):DesktopStorageBinding|null{
  if(!channels.includes('desktop'))return null;
  const normalized=normalizeCompanyStorageTopology(topology);
  if(normalized.mode==='local-single')throw new Error('Esta empresa usa somente este computador. Ative “Vários computadores” e configure o servidor local antes de liberar Desktop para colaboradores.');
  return{mode:normalized.mode,serverId:String(normalized.serverId),autoEnroll:true};
}

export function assertDesktopAdmission(topology:CompanyStorageTopology,input:{isPrincipal:boolean;otherActiveDevices:number}){
  const normalized=normalizeCompanyStorageTopology(topology);
  if(normalized.mode!=='local-single')return true;
  if(!input.isPrincipal)throw new Error('Esta empresa usa o Desktop somente no computador principal. O administrador precisa ativar “Vários computadores” antes de liberar outro usuário.');
  if(Number(input.otherActiveDevices||0)>0)throw new Error('Esta empresa usa somente um computador. Revogue o computador principal anterior antes de autorizar uma substituição.');
  return true;
}


async function inferredExistingLanServer(companyId:string):Promise<string|null>{
  try{
    const env=runtimeEnv() as unknown as {DB?:D1Database};
    if(!env.DB)return null;
    const row=await env.DB.prepare("SELECT server_id FROM lan_server_grants WHERE company_id=? AND status='active' ORDER BY last_seen_at DESC LIMIT 1").bind(companyId).first<{server_id:string}>();
    return row?.server_id&&validServerId(String(row.server_id))?String(row.server_id):null;
  }catch{return null}
}

export async function getCompanyStorageTopology(companyId:string):Promise<CompanyStorageTopology>{
  const id=String(companyId||'').trim();
  if(!id)throw new Error('Empresa não identificada.');
  const existing=(await db.list<CompanyStorageTopology>(table(id),{limit:1})).items[0];
  if(existing)return normalizeCompanyStorageTopology(existing);
  const inferred=await inferredExistingLanServer(id);
  if(inferred)return setCompanyStorageTopology(id,{mode:'lan-server',serverId:inferred});
  return normalizeCompanyStorageTopology({mode:'local-single'});
}

export async function setCompanyStorageTopology(companyId:string,input:Partial<CompanyStorageTopology>):Promise<CompanyStorageTopology>{
  const id=String(companyId||'').trim();
  if(!id)throw new Error('Empresa não identificada.');
  const next=normalizeCompanyStorageTopology({...input,updatedAt:new Date().toISOString()});
  const bucket=table(id),existing=(await db.list<CompanyStorageTopology>(bucket,{limit:1})).items[0];
  if(existing)await db.update(bucket,[{id:(existing as CompanyStorageTopology&{id:string}).id,record:next as unknown as Record<string,unknown>}]);
  else await db.add(bucket,[next as unknown as Record<string,unknown>]);
  return next;
}

export async function clearLanServerTopology(companyId:string,serverId:string):Promise<CompanyStorageTopology>{
  const current=await getCompanyStorageTopology(companyId);
  if(current.mode==='lan-server'&&String(current.serverId||'')===String(serverId||''))return setCompanyStorageTopology(companyId,{mode:'local-single'});
  return current;
}
