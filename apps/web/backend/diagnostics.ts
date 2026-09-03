import { db, recentErrorDiagnostics } from '../cloudflare/sdk';
import { API_CONTRACT_VERSION, APP_VERSION, DB_SCHEMA_VERSION, PROJECT_STATE_VERSION } from '../shared/version';

const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');

export async function systemDiagnostics(input:{companyId?:string;projectId?:string}={}){
  const devices=(await db.list<Record<string,unknown>>('devices',{limit:1000})).items;
  const scopedDevices=input.companyId?devices.filter(device=>String(device.companyId||'')===input.companyId):devices;
  let projectRevision:number|null=null,projectUpdatedAt:string|null=null;
  if(input.projectId){
    const meta=(await db.list<Record<string,unknown>>('project_meta_'+safe(input.projectId),{limit:1})).items[0];
    if(meta){projectRevision=Number(meta.revision||0);projectUpdatedAt=String(meta.updatedAt||'')||null}
  }
  const errors=await recentErrorDiagnostics(30);
  return{
    versions:{app:APP_VERSION,apiContract:API_CONTRACT_VERSION,dbSchema:DB_SCHEMA_VERSION,projectState:PROJECT_STATE_VERSION},
    scope:{companyId:input.companyId||null,projectId:input.projectId||null},
    project:{revision:projectRevision,updatedAt:projectUpdatedAt},
    desktop:{
      total:scopedDevices.length,
      active:scopedDevices.filter(device=>device.status==='active').length,
      revoked:scopedDevices.filter(device=>device.status==='revoked').length,
      expiring:scopedDevices.filter(device=>device.status==='active'&&device.tokenExpiresAt&&Date.parse(String(device.tokenExpiresAt))-Date.now()<7*86400000).length
    },
    recentErrors:errors,
    generatedAt:new Date().toISOString()
  };
}
