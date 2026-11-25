import { db, runtimeEnv } from '../cloudflare/sdk';

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

// Device tokens are bearer secrets. The legacy index used a 32-bit FNV hash of
// the token as the only lookup and never compared the token itself, so any
// colliding string would authenticate. The v2 index is addressed by SHA-256 and
// stores the full digest, which is compared before a device is returned.
const deviceTokenV2Table=(digest:string)=>'device_token_v2_'+digest.slice(0,32);
// Legacy tokens migrate on first use; after this date they must be re-linked.
export const LEGACY_DEVICE_TOKEN_CUTOFF='2027-03-01T00:00:00.000Z';
export async function tokenDigest(token:string){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function sameDigest(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function writeV2Index(deviceId:string,digest:string){
  const table=deviceTokenV2Table(digest),{items}=await db.list<Record<string,unknown>>(table,{limit:1});
  const record={deviceId,tokenHash:digest,indexedAt:now()};
  if(items[0])await db.update(table,[{id:String(items[0].id),record}]);
  else await db.add(table,[record]);
}

export async function indexDeviceToken(deviceId:string,token:string){
  const digest=await tokenDigest(token);
  await writeV2Index(deviceId,digest);
  const [device]=await db.get<Device&{tokenHash?:string}>('devices',[deviceId]);
  if(device)await db.update('devices',[{id:deviceId,record:{...device,tokenHash:digest,updatedAt:now()} as unknown as Record<string,unknown>}]);
}

export async function deviceByToken(token:string,{nowIso=now()}:{nowIso?:string}={}){
  if(token.length<48||token.length>512)return null;
  const digest=await tokenDigest(token);
  const current=(await db.list<Record<string,unknown>>(deviceTokenV2Table(digest),{limit:1})).items[0];
  if(current){
    if(!sameDigest(String(current.tokenHash||''),digest))return null;
    const id=String(current.deviceId||''),[device]=await db.get<Device&{tokenHash?:string}>('devices',[id]);
    if(!device||(device.tokenHash&&!sameDigest(device.tokenHash,digest)))return null;
    return {...device,id};
  }
  // Legacy path: only for devices that never had a verified digest, before the cutoff.
  if(nowIso>=LEGACY_DEVICE_TOKEN_CUTOFF)return null;
  const legacyTable=deviceTokenTable(token),ref=(await db.list<Record<string,unknown>>(legacyTable,{limit:1})).items[0];
  if(!ref)return null;
  const id=String(ref.deviceId||''),[device]=await db.get<Device&{tokenHash?:string}>('devices',[id]);
  if(!device||device.tokenHash)return null;
  // Bind the digest of the presented token and retire the collision-prone index.
  await writeV2Index(id,digest);
  await db.update('devices',[{id,record:{...device,tokenHash:digest,updatedAt:now()} as unknown as Record<string,unknown>}]);
  await db.delete(legacyTable,[String(ref.id)]);
  return {...device,id,tokenHash:digest};
}

export async function getDesktopSyncHead(projectId:string){
  const{items}=await db.list<Record<string,unknown>>(desktopSyncHeadTable(projectId),{limit:1});
  return items[0]||null;
}

const KV_INSERT_ONCE="INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO NOTHING";
const KV_CAS_REVISION="UPDATE kv_records SET record_json=?,updated_at=? WHERE collection=? AND id=? AND CAST(json_extract(record_json,'$.revision') AS INTEGER)=?";
async function claimNextDesktopRevision(projectId:string,stamp:string){
  // Atomic allocation: concurrent pushes can no longer receive the same revision.
  for(let attempt=0;attempt<16;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,Math.min(150,8*attempt)+Math.random()*20));
    const head=await getDesktopSyncHead(projectId),table=desktopSyncHeadTable(projectId);
    if(!head){
      const created=await runtimeEnv().DB.prepare(KV_INSERT_ONCE).bind(table,'head',JSON.stringify({revision:1,updatedAt:stamp}),stamp,stamp).run();
      if(Number(created.meta?.changes||0)===1)return 1;
      continue;
    }
    const current=Number(head.revision||0),revision=current+1;
    const moved=await runtimeEnv().DB.prepare(KV_CAS_REVISION).bind(JSON.stringify({revision,updatedAt:stamp}),stamp,table,String(head.id),current).run();
    if(Number(moved.meta?.changes||0)===1)return revision;
  }
  throw new Error('Fila de sincronização ocupada; nova tentativa automática.');
}

export async function appendDesktopSyncChange(projectId:string,deviceId:string,change:Record<string,unknown>){
  const changeId=String(change.changeId||'').trim();
  if(changeId.length<12)throw new Error('changeId inválido.');
  const refTable=desktopSyncIdTable(projectId,changeId),refs=(await db.list<Record<string,unknown>>(refTable,{limit:1})).items;
  if(refs[0])return{revision:Number(refs[0].revision||0),duplicate:true};
  const stamp=now(),payload=rec(change.payload);
  const draft={changeId,deviceId,entity:String(change.entity||''),action:String(change.action||''),localId:Number(change.localId||0)||undefined,localAuditId:Number(change.localAuditId||0)||undefined,baseMobileRevision:Number(change.baseMobileRevision||0),payload,createdAt:stamp};
  if(JSON.stringify({revision:0,...draft}).length>120000)throw new Error('Alteração local excede o limite de sincronização.');
  const revision=await claimNextDesktopRevision(projectId,stamp);
  // The change id is claimed once; a concurrent retry of the same change reuses the winner.
  const claimed=await runtimeEnv().DB.prepare(KV_INSERT_ONCE).bind(refTable,'ref',JSON.stringify({revision,createdAt:stamp}),stamp,stamp).run();
  if(Number(claimed.meta?.changes||0)!==1){
    const winner=(await db.list<Record<string,unknown>>(refTable,{limit:1})).items[0];
    return{revision:Number(winner?.revision||revision),duplicate:true};
  }
  await db.add(desktopSyncChangeTable(projectId,revision),[{revision,...draft}]);
  return{revision,duplicate:false};
}
