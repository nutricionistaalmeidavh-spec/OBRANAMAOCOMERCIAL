import { db } from '../cloudflare/sdk';

export type Device={
  installationId:string;
  name:string;
  platform?:string;
  companyId?:string;
  projectId?:string;
  userId:string;
  email:string;
  licenseId?:string;
  status:'active'|'revoked';
  tokenExpiresAt?:string;
  createdAt:string;
  updatedAt:string;
  lastSeenAt:string;
};

export type DesktopAuth={
  requestId:string;
  secretHash:string;
  installationId:string;
  deviceName:string;
  platform?:string;
  activationCode?:string;
  status:'pending'|'approved';
  expiresAt:string;
  deviceId?:string;
  deviceToken?:string;
  createdAt:string;
  updatedAt:string;
};

const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
function hashKey(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const now=()=>new Date().toISOString();
const rec=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

const desktopAuthTable=(requestId:string)=>'desktop_auth_'+safe(requestId);
const deviceTokenTable=(token:string)=>'device_token_'+hashKey(token);
const desktopSyncHeadTable=(projectId:string)=>'desktop_sync_head_'+safe(projectId);
const desktopSyncChangeTable=(projectId:string,revision:number)=>'desktop_sync_change_'+safe(projectId)+'_'+revision;
const desktopSyncIdTable=(projectId:string,changeId:string)=>'desktop_sync_id_'+safe(projectId)+'_'+hashKey(changeId);

export async function getDesktopAuth(requestId:string){
  const{items}=await db.list<DesktopAuth>(desktopAuthTable(requestId),{limit:1});
  return items[0]||null;
}

export async function saveDesktopAuth(record:DesktopAuth){
  const table=desktopAuthTable(record.requestId),current=await getDesktopAuth(record.requestId);
  if(current)await db.update(table,[{id:current.id,record:record as unknown as Record<string,unknown>}]);
  else await db.add(table,[record as unknown as Record<string,unknown>]);
}

export async function indexDeviceToken(deviceId:string,token:string){
  const table=deviceTokenTable(token),{items}=await db.list<Record<string,unknown>>(table,{limit:1});
  if(items[0])await db.update(table,[{id:items[0].id,record:{deviceId}}]);
  else await db.add(table,[{deviceId}]);
}

export async function deviceByToken(token:string){
  if(token.length<48)return null;
  const{items}=await db.list<Record<string,unknown>>(deviceTokenTable(token),{limit:1}),ref=items[0];
  if(!ref)return null;
  const id=String(ref.deviceId||''),[device]=await db.get<Device>('devices',[id]);
  return device?{...device,id}:null;
}

export async function getDesktopSyncHead(projectId:string){
  const{items}=await db.list<Record<string,unknown>>(desktopSyncHeadTable(projectId),{limit:1});
  return items[0]||null;
}

export async function appendDesktopSyncChange(projectId:string,deviceId:string,change:Record<string,unknown>){
  const changeId=String(change.changeId||'').trim();
  if(changeId.length<12)throw new Error('changeId inválido.');
  const refTable=desktopSyncIdTable(projectId,changeId),refs=(await db.list<Record<string,unknown>>(refTable,{limit:1})).items;
  if(refs[0])return{revision:Number(refs[0].revision||0),duplicate:true};
  const head=await getDesktopSyncHead(projectId),revision=Number(head?.revision||0)+1,stamp=now(),payload=rec(change.payload);
  const record={revision,changeId,deviceId,entity:String(change.entity||''),action:String(change.action||''),localId:Number(change.localId||0)||undefined,localAuditId:Number(change.localAuditId||0)||undefined,baseMobileRevision:Number(change.baseMobileRevision||0),payload,createdAt:stamp};
  if(JSON.stringify(record).length>120000)throw new Error('Alteração local excede o limite de sincronização.');
  await db.add(desktopSyncChangeTable(projectId,revision),[record]);
  if(head)await db.update(desktopSyncHeadTable(projectId),[{id:head.id,record:{revision,updatedAt:stamp}}]);
  else await db.add(desktopSyncHeadTable(projectId),[{revision,updatedAt:stamp}]);
  await db.add(refTable,[{revision,createdAt:stamp}]);
  return{revision,duplicate:false};
}
