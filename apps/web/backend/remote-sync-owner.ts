/**
 * Immutable assignment of the Cloudflare/PWA bridge coordinator for a remote
 * Server's company/project. This does not elect an arbitrary LAN client and
 * does not move any local SQLite database. The assignment is explicitly
 * immutable so changing machines requires a separately audited migration.
 */
export type RemoteSyncScope={companyId:string;projectId:string;serverId:string;deviceId:string}
type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<{meta?:{changes?:number}}>;first:<T>()=>Promise<T|null>}
type D1Compatible={prepare:(sql:string)=>D1Statement}
type OwnerRow={record_json:string}
const COLLECTION='remote_sync_owners_v1'

function cleanScope(input:RemoteSyncScope){
  const companyId=String(input.companyId||'').trim()
  const projectId=String(input.projectId||'').trim()
  const serverId=String(input.serverId||'').trim()
  const deviceId=String(input.deviceId||'').trim()
  if(!companyId||!projectId||!serverId||!deviceId)throw new Error('Escopo incompleto da sincronização remota.')
  if([companyId,projectId,serverId,deviceId].some(item=>item.length>128))throw new Error('Escopo de sincronização remota inválido.')
  return{companyId,projectId,serverId,deviceId}
}
function parse(row:OwnerRow|null){
  if(!row?.record_json)return null
  try{
    const result=JSON.parse(row.record_json)
    return result&&typeof result==='object'?result as RemoteSyncScope:null
  }catch{return null}
}

export function createRemoteSyncOwnerService({db,nowMs=Date.now}:{db:D1Compatible;nowMs?:()=>number}){
  async function get(companyId:string,projectId:string){
    const key=JSON.stringify([companyId,projectId])
    const row=await db.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=? LIMIT 1')
      .bind(COLLECTION,key).first<OwnerRow>()
    return parse(row)
  }
  async function acquire(input:RemoteSyncScope){
    const scope=cleanScope(input),stamp=new Date(nowMs()).toISOString()
    const key=JSON.stringify([scope.companyId,scope.projectId])
    // Atomic first-claim wins on D1's (collection,id) primary key.
    await db.prepare('INSERT OR IGNORE INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(COLLECTION,key,JSON.stringify({...scope,assignedAt:stamp}),stamp,stamp).run()
    const stored=await get(scope.companyId,scope.projectId)
    if(!stored)throw new Error('Falha ao consultar o coordenador de sincronização remota.')
    return{owner:stored.deviceId===scope.deviceId&&stored.serverId===scope.serverId,deviceId:stored.deviceId,serverId:stored.serverId}
  }
  async function verify(input:RemoteSyncScope){
    let scope:ReturnType<typeof cleanScope>
    try{scope=cleanScope(input)}catch{return false}
    const stored=await get(scope.companyId,scope.projectId)
    return!!stored&&stored.deviceId===scope.deviceId&&stored.serverId===scope.serverId
  }
  return{acquire,verify}
}
