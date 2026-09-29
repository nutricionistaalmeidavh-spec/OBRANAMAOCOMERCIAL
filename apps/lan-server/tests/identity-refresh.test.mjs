import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer, refreshIdentitySnapshot } from '../src/server.mjs'
import { LanAuthorizationError } from '../src/authorization.mjs'

const digest=value=>createHash('sha256').update(String(value)).digest('hex')

function snapshot(memberStatus='active'){
  return{companyId:'company-a',revision:`rev-${memberStatus}`,generatedAt:'2026-09-29T20:00:00.000Z',members:[{memberId:'member-admin',email:'admin@example.com',role:'admin',modules:['obra360'],channels:['desktop'],status:memberStatus}]}
}

test('failed Cloud refresh preserves last-known cache; successful refresh replaces it',async()=>{
  let current=snapshot('active'),replaceCalls=0,fail=true
  const security={
    serverState(){return{claimed:true,companyId:'company-a',serverToken:'server-secret',identityRevision:current.revision,lastCloudRefreshAt:current.generatedAt}},
    replaceSnapshot(next){replaceCalls++;current=structuredClone(next)}
  }
  const cloudAuthority={async snapshot(){if(fail)throw new Error('offline');return{snapshot:snapshot('revoked')}}}

  await assert.rejects(()=>refreshIdentitySnapshot({security,cloudAuthority}),/offline/)
  assert.equal(replaceCalls,0)
  assert.equal(current.members[0].status,'active')

  fail=false
  await refreshIdentitySnapshot({security,cloudAuthority})
  assert.equal(replaceCalls,1)
  assert.equal(current.members[0].status,'revoked')
})

function serverFixture(){
  const token='admin-device-token'
  const state={claimed:true,companyId:'company-a',companyName:'Empresa A',serverToken:'server-secret',identityRevision:'rev-1',lastCloudRefreshAt:'2026-09-29T20:00:00.000Z'}
  const security={
    serverState(){return{...state}},
    replaceSnapshot(next){state.identityRevision=next.revision;state.lastCloudRefreshAt=next.generatedAt},
    deviceByTokenHash(value){return value===digest(token)?{id:'device-admin',memberId:'member-admin',status:'active'}:null},
    member(id){return id==='member-admin'?{memberId:id,email:'admin@example.com',role:'admin',modules:['obra360'],channels:['desktop'],status:'active'}:null},
    touchDevice(){},
    listDevices(){return[{id:'device-admin',status:'active'},{id:'device-old',status:'revoked'}]}
  }
  const cloudAuthority={async snapshot(){return{snapshot:{companyId:'company-a',revision:'rev-2',generatedAt:'2026-09-29T20:05:00.000Z',members:[]}}}}
  return{security,cloudAuthority,token,state}
}

async function listen(fx){
  const server=createLanServer({security:fx.security,cloudAuthority:fx.cloudAuthority,nowMs:()=>Date.parse('2026-09-29T20:20:00.000Z')})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();return{server,baseUrl:`http://127.0.0.1:${address.port}`}
}
async function close(server){server.close();await once(server,'close')}

test('Admin status reports revision, device count and stale cache without secrets',async()=>{
  const fx=serverFixture(),runtime=await listen(fx)
  try{
    const response=await fetch(`${runtime.baseUrl}/api/v1/admin/status`,{headers:{authorization:`Bearer ${fx.token}`}})
    assert.equal(response.status,200)
    const body=await response.json()
    assert.equal(body.company.id,'company-a')
    assert.equal(body.revision,'rev-1')
    assert.equal(body.deviceCount,2)
    assert.equal(body.stale,true)
    assert.equal(JSON.stringify(body).includes('server-secret'),false)
  }finally{await close(runtime.server)}
})

test('Admin can request immediate identity refresh',async()=>{
  const fx=serverFixture(),runtime=await listen(fx)
  try{
    const response=await fetch(`${runtime.baseUrl}/api/v1/admin/identity/refresh`,{method:'POST',headers:{authorization:`Bearer ${fx.token}`}})
    assert.equal(response.status,200)
    const body=await response.json()
    assert.equal(body.revision,'rev-2')
    assert.equal(fx.state.identityRevision,'rev-2')
  }finally{await close(runtime.server)}
})
