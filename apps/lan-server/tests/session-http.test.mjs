import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const TOKEN='device-token'
const digest=value=>createHash('sha256').update(String(value)).digest('hex')
async function close(server){server.close();await once(server,'close')}

function security(status='active'){
  return{
    serverState(){return{claimed:true,serverId:'srv-a',companyId:'company-a'}},
    deviceByTokenHash(value){return value===digest(TOKEN)?{id:'dev-a',memberId:'m-a',status}:null},
    member(id){return id==='m-a'?{memberId:'m-a',email:'u@example.com',name:'Usuário',role:'foreman',modules:['obra360'],channels:['desktop'],status:'active'}:null},
    touchDevice(){}
  }
}

test('authenticated session confirms stable server/device/member identity without secrets',async()=>{
  const server=createLanServer({security:security()})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  try{
    const address=server.address()
    const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/session`,{headers:{authorization:`Bearer ${TOKEN}`}})
    assert.equal(response.status,200)
    const payload=await response.json()
    assert.deepEqual(payload,{
      serverId:'srv-a',
      companyId:'company-a',
      device:{id:'dev-a',status:'active'},
      member:{memberId:'m-a',email:'u@example.com',name:'Usuário',role:'foreman',modules:['obra360'],channels:['desktop'],status:'active'}
    })
    assert.equal(JSON.stringify(payload).includes(TOKEN),false)
  }finally{await close(server)}
})

test('authenticated session applies device revocation immediately',async()=>{
  const server=createLanServer({security:security('revoked')})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  try{
    const address=server.address()
    const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/session`,{headers:{authorization:`Bearer ${TOKEN}`}})
    assert.equal(response.status,403)
    assert.equal((await response.json()).error,'device_revoked')
  }finally{await close(server)}
})
