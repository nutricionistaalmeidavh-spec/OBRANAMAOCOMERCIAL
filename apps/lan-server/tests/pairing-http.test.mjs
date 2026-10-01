import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const tokenHash=value=>createHash('sha256').update(String(value)).digest('hex')
const ADMIN_TOKEN='admin-token'

function security(){
  return{
    serverState(){return{claimed:true,companyId:'company-a'}},
    deviceByTokenHash(value){return value===tokenHash(ADMIN_TOKEN)?{id:'device-admin',memberId:'member-admin',status:'active'}:null},
    member(id){return id==='member-admin'?{memberId:id,email:'admin@example.com',role:'admin',modules:['obra360'],channels:['desktop'],status:'active'}:null},
    touchDevice(){}
  }
}

async function fixture(){
  const calls=[]
  const pairingService={
    createInvitation(input){calls.push(['createInvitation',input]);return{code:'PAIR-1234',expiresAt:'2026-09-29T20:10:00.000Z',member:{memberId:'member-a'}}},
    claim(input){calls.push(['claim',input]);return{device:{id:'device-b',memberId:'member-a',status:'active'},member:{memberId:'member-a'},deviceToken:'device-secret'}},
    listDevices(actor){calls.push(['listDevices',actor]);return[{id:'device-b',memberId:'member-a',status:'active'}]},
    setDeviceStatus(input){calls.push(['setDeviceStatus',input]);return{id:input.deviceId,memberId:'member-a',status:input.status}}
  }
  const server=createLanServer({security:security(),pairingService})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();return{server,calls,baseUrl:`http://127.0.0.1:${address.port}`}
}
async function close(server){server.close();await once(server,'close')}
const auth=()=>({authorization:`Bearer ${ADMIN_TOKEN}`,'content-type':'application/json'})

test('admin creates pairing code and lists devices through authenticated routes',async()=>{
  const {server,baseUrl,calls}=await fixture()
  try{
    const create=await fetch(`${baseUrl}/api/v1/admin/pairing`,{method:'POST',headers:auth(),body:JSON.stringify({targetMemberId:'member-a'})})
    assert.equal(create.status,201);assert.equal((await create.json()).code,'PAIR-1234')
    const list=await fetch(`${baseUrl}/api/v1/admin/devices`,{headers:auth()})
    assert.equal(list.status,200);assert.equal((await list.json()).devices.length,1)
    assert.equal(calls[0][0],'createInvitation');assert.equal(calls[1][0],'listDevices')
  }finally{await close(server)}
})

test('public pair claim returns a device token once and passes client address for rate limiting',async()=>{
  const {server,baseUrl,calls}=await fixture()
  try{
    const response=await fetch(`${baseUrl}/api/v1/pair/claim`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'PAIR-1234',installationId:'install-b',deviceName:'PC 2'})})
    assert.equal(response.status,201)
    const payload=await response.json();assert.equal(payload.deviceToken,'device-secret')
    const call=calls.find(([name])=>name==='claim');assert.ok(call);assert.ok(typeof call[1].clientKey==='string')
  }finally{await close(server)}
})

test('admin can revoke or reactivate a device; unauthenticated admin route is denied',async()=>{
  const {server,baseUrl,calls}=await fixture()
  try{
    const denied=await fetch(`${baseUrl}/api/v1/admin/devices`);assert.equal(denied.status,401)
    const updated=await fetch(`${baseUrl}/api/v1/admin/devices/device-b`,{method:'PUT',headers:auth(),body:JSON.stringify({status:'revoked'})})
    assert.equal(updated.status,200);assert.equal((await updated.json()).device.status,'revoked')
    assert.equal(calls.at(-1)[0],'setDeviceStatus')
  }finally{await close(server)}
})
