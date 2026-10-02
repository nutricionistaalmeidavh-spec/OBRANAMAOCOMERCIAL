import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const token='admin-token'
const digest=value=>createHash('sha256').update(value).digest('hex')
const security={
  serverState:()=>({claimed:true,serverId:'srv-a',companyId:'company-a',companyName:'Empresa A',identityRevision:'r8',lastCloudRefreshAt:'2026-10-01T12:00:00.000Z'}),
  deviceByTokenHash:value=>value===digest(token)?{id:'dev-a',memberId:'admin-a',status:'active'}:null,
  member:id=>id==='admin-a'?{memberId:'admin-a',email:'admin@example.com',name:'Admin',role:'admin',modules:['core','operation','planning','finance','rh'],channels:['desktop'],status:'active'}:null,
  touchDevice(){},
  listDevices:()=>[{id:'dev-a',status:'active'},{id:'dev-b',status:'revoked'}]
}
const centralStorage={health:()=>({accessible:true,integrity:'ok',schemaVersion:6,claimed:true,serverId:'srv-a',companyId:'company-a',sizeBytes:321,lastBackup:{backupId:'b1',createdAt:'2026-10-01T10:00:00.000Z'},maintenance:false})}
const backupOperations={
  status:()=>({enabled:true,running:true,intervalHours:24,retentionCount:7,lastRun:{status:'success',at:'2026-10-01T10:00:00.000Z'},nextRunAt:'2026-10-02T10:00:00.000Z'}),
  list:()=>[{backupId:'b1',createdAt:'2026-10-01T10:00:00.000Z',reason:'scheduled',integrity:'ok'}],
  testRestore:async id=>({restorable:true,backupId:id,integrity:'ok'}),
  preUpgrade:async()=>({backup:{backupId:'pre-1'},verified:true,retention:{removed:[]}})
}
const pairingService={listDevices:()=>security.listDevices()}
async function withServer(fn){
  const server=createLanServer({serverVersion:'0.3.0',security,centralBackupService:centralStorage,backupOperationsService:backupOperations,pairingService,runtimeInfo:{mode:'remote',transport:'reverse-proxy'}})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  try{const a=server.address();await fn(`http://127.0.0.1:${a.port}`)}finally{server.close();await once(server,'close')}
}
const auth={authorization:`Bearer ${token}`}

test('admin operations aggregates version readiness backup devices authority sync and capabilities without secrets',()=>withServer(async base=>{
  const response=await fetch(base+'/api/v1/admin/operations',{headers:auth})
  assert.equal(response.status,200)
  const body=await response.json()
  assert.equal(body.server.version,'0.3.0')
  assert.deepEqual(body.server.runtime,{mode:'remote',transport:'reverse-proxy'})
  assert.equal(body.storage.integrity,'ok')
  assert.equal(body.backup.policy.retentionCount,7)
  assert.equal(body.devices.total,2)
  assert.equal(body.devices.active,1)
  assert.equal(body.authority.revision,'r8')
  assert.ok(body.capabilities.modules.includes('finance'))
  const serialized=JSON.stringify(body)
  for(const secret of ['admin-token','server-secret','tokenHash','setupCode'])assert.equal(serialized.includes(secret),false)
}))

test('admin can list backups, test restore and create pre-upgrade backup without receiving filesystem paths',()=>withServer(async base=>{
  let response=await fetch(base+'/api/v1/admin/storage/backups',{headers:auth})
  assert.equal(response.status,200)
  let body=await response.json()
  assert.deepEqual(body.backups.map(x=>x.backupId),['b1'])

  response=await fetch(base+'/api/v1/admin/storage/restore-test',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({backupId:'b1'})})
  assert.equal(response.status,200)
  body=await response.json()
  assert.equal(body.restorable,true)

  response=await fetch(base+'/api/v1/admin/storage/pre-upgrade',{method:'POST',headers:{...auth,'content-type':'application/json'},body:'{}'})
  assert.equal(response.status,201)
  body=await response.json()
  assert.equal(body.backup.backupId,'pre-1')
  assert.equal(JSON.stringify(body).includes('/'),false)
}))
