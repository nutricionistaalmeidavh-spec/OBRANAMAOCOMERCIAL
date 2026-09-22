import { sameOriginMutationAllowed } from '../cloudflare/sdk';

type GovernanceEnv={DB:D1Database};
type BootstrapContext={
  role?:string;
  membership?:{companyId?:string;projectId?:string};
  company?:{id?:string};
  project?:{id?:string};
  access?:{licenseId?:string;modules?:string[];channels?:string[];status?:string};
};
type DeviceRecord={id:string;installationId?:string;name?:string;platform?:string;companyId?:string;projectId?:string;email?:string;status?:'active'|'revoked';lastSeenAt?:string;updatedAt?:string;createdAt?:string};
type Authorize=()=>Promise<Response>;

const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'}});
const error=(message:string,status=400)=>json({error:message},status);
const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
const asRecord=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const positive=(value:unknown,fallback:number)=>{const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?Math.min(n,999):fallback};

export function isAdminGovernancePath(pathname:string){return pathname==='/api/mobile/admin/devices'||pathname.startsWith('/api/mobile/admin/devices/')||pathname==='/api/mobile/admin/sync-status'}
async function rows(env:GovernanceEnv,collection:string,limit=1000){const result=await env.DB.prepare('SELECT id, record_json, updated_at FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT ?').bind(collection,limit).all<{id:string;record_json:string;updated_at:string}>();return(result.results||[]).map(row=>{let record:Record<string,unknown>={};try{record=JSON.parse(row.record_json) as Record<string,unknown>}catch{}return{...record,id:row.id,_dbUpdatedAt:row.updated_at}})}
async function recordById(env:GovernanceEnv,collection:string,id:string){const row=await env.DB.prepare('SELECT id, record_json, updated_at FROM kv_records WHERE collection=? AND id=?').bind(collection,id).first<{id:string;record_json:string;updated_at:string}>();if(!row)return null;let record:Record<string,unknown>={};try{record=JSON.parse(row.record_json) as Record<string,unknown>}catch{}return{...record,id:row.id,_dbUpdatedAt:row.updated_at}}
async function tenantDevices(env:GovernanceEnv,companyId:string){const items=await rows(env,'devices',500);return items.filter(item=>String(item.companyId||'')===companyId).map(item=>({id:String(item.id),installationId:String(item.installationId||''),name:String(item.name||'Computador'),platform:String(item.platform||''),email:String(item.email||''),projectId:item.projectId?String(item.projectId):undefined,status:String(item.status||'revoked')==='active'?'active':'revoked',lastSeenAt:item.lastSeenAt?String(item.lastSeenAt):undefined,updatedAt:item.updatedAt?String(item.updatedAt):String(item._dbUpdatedAt||''),createdAt:item.createdAt?String(item.createdAt):undefined} as DeviceRecord))}

async function updateDeviceStatus(env:GovernanceEnv,companyId:string,licenseId:string|undefined,deviceId:string,status:'active'|'revoked'){
  const target=await recordById(env,'devices',deviceId);if(!target||String(target.companyId||'')!==companyId)return error('Computador não encontrado nesta empresa.',404);
  if(status==='active'&&String(target.status||'')!=='active'){
    let maxDevices=999;if(licenseId&&licenseId!=='owner'){const license=await recordById(env,'licenses',licenseId);if(license)maxDevices=positive(license.maxDevices,999)}
    const devices=await tenantDevices(env,companyId),active=devices.filter(device=>device.status==='active'&&device.id!==deviceId).length;if(active>=maxDevices)return error(`Limite de ${maxDevices} computador(es) ativo(s) atingido para esta licença.`,409);
  }
  const stamp=new Date().toISOString(),next={...target,status,updatedAt:stamp};delete next.id;delete next._dbUpdatedAt;await env.DB.prepare("UPDATE kv_records SET record_json=?,updated_at=? WHERE collection='devices' AND id=?").bind(JSON.stringify(next),stamp,deviceId).run();return json({ok:true,status,device:{id:deviceId,...next}});
}

async function syncStatus(env:GovernanceEnv,companyId:string,projectId:string){
  const devices=await tenantDevices(env,companyId),meta=(await rows(env,`project_meta_${safe(projectId)}`,1))[0]||{},desktop=(await rows(env,`desktop_sync_head_${safe(projectId)}`,1))[0]||{},conflicts=await rows(env,`sync_conflicts_${safe(projectId)}`,100),openConflicts=conflicts.filter(item=>String(item.status||'')==='open'),seen=devices.map(device=>device.lastSeenAt||'').filter(Boolean).sort().at(-1)||null;
  return json({serverRevision:Math.max(0,Number(meta.revision||0)),desktopRevision:Math.max(0,Number(desktop.revision||0)),conflictCount:openConflicts.length,lastServerUpdateAt:meta.updatedAt?String(meta.updatedAt):String(meta._dbUpdatedAt||'')||null,lastDesktopPushAt:desktop.updatedAt?String(desktop.updatedAt):String(desktop._dbUpdatedAt||'')||null,lastDesktopSeenAt:seen,activeDevices:devices.filter(device=>device.status==='active').length,revokedDevices:devices.filter(device=>device.status==='revoked').length,devices});
}

export async function handleAdminGovernanceRequest(request:Request,env:GovernanceEnv,authorize:Authorize):Promise<Response|null>{
  const url=new URL(request.url);if(!isAdminGovernancePath(url.pathname))return null;
  if(!sameOriginMutationAllowed(request))return error('Origem da requisição não autorizada.',403);
  const authResponse=await authorize();if(!authResponse.ok)return authResponse;
  let bootstrap:BootstrapContext={};try{bootstrap=await authResponse.clone().json() as BootstrapContext}catch{return error('Não foi possível validar a sessão administrativa.',500)}
  const companyId=String(bootstrap.membership?.companyId||bootstrap.company?.id||''),projectId=String(bootstrap.membership?.projectId||bootstrap.project?.id||'');
  if(bootstrap.role!=='admin'||!companyId||!projectId)return error('Apenas Admin da empresa pode gerenciar acessos e sincronização.',403);
  if(bootstrap.access?.status&&bootstrap.access.status!=='active')return error('Acesso administrativo indisponível para esta licença.',403);
  if(!bootstrap.access?.channels?.includes('mobile')||!bootstrap.access?.modules?.includes('obra360'))return error('Obra360 mobile não está liberado para este acesso.',403);
  if(url.pathname==='/api/mobile/admin/devices'&&request.method==='GET')return json({devices:await tenantDevices(env,companyId)});
  if(url.pathname==='/api/mobile/admin/sync-status'&&request.method==='GET')return syncStatus(env,companyId,projectId);
  const match=url.pathname.match(/^\/api\/mobile\/admin\/devices\/([^/]+)$/);if(match&&request.method==='PUT'){let body:Record<string,unknown>={};try{body=asRecord(await request.json())}catch{}const status=String(body.status||'');if(status!=='active'&&status!=='revoked')return error('Status de computador inválido.',400);return updateDeviceStatus(env,companyId,bootstrap.access?.licenseId,decodeURIComponent(match[1]),status)}
  return error('Método não permitido.',405);
}
