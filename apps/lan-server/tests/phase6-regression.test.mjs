import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const TOKEN='phase6-regression-token'
const digest=value=>createHash('sha256').update(String(value)).digest('hex')
const security={
  serverState(){return{claimed:true,companyId:'company-a'}},
  deviceByTokenHash(value){return value===digest(TOKEN)?{id:'device-a',memberId:'member-a',status:'active'}:null},
  member(id){return id==='member-a'?{memberId:id,role:'employee',modules:['obra360'],channels:['desktop'],permissions:{core:['view'],operation:['view'],planning:['view'],finance:[],rh:[]},status:'active'}:null},
  touchDevice(){}
}

test('Fase 6 preserva rotas especializadas anteriores sem interceptar autorização',async()=>{
  const server=createLanServer({security,planningService:{overview(){return{ok:true,phase:'planning'}}}})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  try{
    const address=server.address();if(!address||typeof address==='string')throw new Error('porta ausente')
    const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/planning/overview?obra_id=1`,{headers:{authorization:`Bearer ${TOKEN}`}})
    const payload=await response.json()
    assert.deepEqual({status:response.status,payload},{status:200,payload:{ok:true,phase:'planning'}})
  }finally{server.close();await once(server,'close')}
})
