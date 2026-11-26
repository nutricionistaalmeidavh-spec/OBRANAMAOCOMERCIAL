import { runtimeEnv } from '../cloudflare/sdk';

const safe=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,'_');
const collection=(projectId:string)=>'desktop_presence_'+safe(projectId);
const PRESENCE_WRITE_INTERVAL_MS=2*60*1000;

/**
 * The office Desktop is the source of truth; the web needs to know whether it is
 * online. A heartbeat is written at most every 2 minutes per project.
 */
export async function touchDesktopPresence(projectId:string,deviceId:string,now=new Date()){
  if(!projectId||!deviceId)return;
  const DB=runtimeEnv().DB,current=await DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').bind(collection(projectId),'latest').first<{record_json:string}>();
  let seenAt='';try{seenAt=String(JSON.parse(current?.record_json||'{}').seenAt||'')}catch{}
  if(seenAt&&now.getTime()-Date.parse(seenAt)<PRESENCE_WRITE_INTERVAL_MS)return;
  const stamp=now.toISOString();
  await DB.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`)
    .bind(collection(projectId),'latest',JSON.stringify({deviceId,seenAt:stamp}),stamp,stamp).run();
}

export async function desktopSeenAt(projectId:string):Promise<string|null>{
  const row=await runtimeEnv().DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').bind(collection(projectId),'latest').first<{record_json:string}>();
  try{return String(JSON.parse(row?.record_json||'{}').seenAt||'')||null}catch{return null}
}
