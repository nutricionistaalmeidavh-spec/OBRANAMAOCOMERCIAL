import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const digest=value=>createHash('sha256').update(String(value)).digest('hex')

function security(role='admin'){
  return {
    serverState:()=>({claimed:true,companyId:'company-a'}),
    deviceByTokenHash:hash=>hash===digest('admin-token')?{id:'device-a',memberId:'member-a',status:'active'}:null,
    member:id=>id==='member-a'?{memberId:id,role,status:'active',channels:['desktop'],modules:['obra360','finance','rh']}:null,
    touchDevice:()=>{}
  }
}

async function withServer({role='admin'}={},work){
  const calls=[]
  const migrationService={
    start:input=>{calls.push(['start',input]);return {status:'started',...input}},
    importRecord:(id,input)=>{calls.push(['record',id,input]);return {targetId:1,reused:false}},
    status:id=>{calls.push(['status',id]);return {migrationId:id,status:'started'}},
    validate:id=>{calls.push(['validate',id]);return {migrationId:id,status:'validated'}},
    commit:id=>{calls.push(['commit',id]);return {migrationId:id,status:'committed'}},
    rollback:id=>{calls.push(['rollback',id]);return {migrationId:id,status:'rolled_back'}}
  }
  const server=createLanServer({security:security(role),migrationService})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();const base=`http://127.0.0.1:${address.port}`
  try{return await work({base,calls})}finally{server.close();await once(server,'close')}
}

const auth={'authorization':'Bearer admin-token','content-type':'application/json'}
const post=(base,path,body={})=>fetch(base+path,{method:'POST',headers:auth,body:JSON.stringify(body)})

test('admin device can execute the authenticated migration lifecycle',async()=>withServer({},async({base,calls})=>{
  let response=await post(base,'/api/v1/migrations/start',{migrationId:'mig-1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1}})
  assert.equal(response.status,201)
  response=await post(base,'/api/v1/migrations/mig-1/record',{sourceTable:'empresas',sourceId:1,data:{id:1,razao_social:'A'}})
  assert.equal(response.status,201)
  response=await fetch(base+'/api/v1/migrations/mig-1/status',{headers:{authorization:'Bearer admin-token'}})
  assert.equal(response.status,200)
  for(const action of ['validate','commit','rollback']){response=await post(base,`/api/v1/migrations/mig-1/${action}`);assert.equal(response.status,200)}
  assert.deepEqual(calls.map(item=>item[0]),['start','record','status','validate','commit','rollback'])
}))

test('migration mutations require an Admin Desktop member',async()=>withServer({role:'foreman'},async({base})=>{
  const response=await post(base,'/api/v1/migrations/start',{migrationId:'mig-1',module:'core',sourceFingerprint:'source-1',expectedCounts:{}})
  assert.equal(response.status,403)
  assert.equal((await response.json()).error,'admin_required')
}))

test('migration status still requires an authenticated device',async()=>withServer({},async({base})=>{
  const response=await fetch(base+'/api/v1/migrations/mig-1/status')
  assert.equal(response.status,401)
  assert.equal((await response.json()).error,'missing_device_token')
}))
