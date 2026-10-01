import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'
import { ServerIdentity } from '../src/server-identity.mjs'
import { PairingService } from '../src/pairing-service.mjs'
import { createLanServer } from '../src/server.mjs'

async function close(server,repository){server.close();await once(server,'close');repository.close()}
const jsonHeaders=token=>({'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})})
const post=(base,path,body,token)=>fetch(base+path,{method:'POST',headers:jsonHeaders(token),body:JSON.stringify(body)})

test('full LAN flow: Cloud admin claims server, pairs second PC, uses central CRUD and revokes it',async()=>{
  const repository=new LanRepository({filename:':memory:'})
  const security=new LanSecurityRepository({db:repository.connection(),now:()=>new Date().toISOString()})
  const identity=new ServerIdentity({security,serverIdFactory:()=> 'server-flow',setupCodeFactory:()=> 'FLOW-CODE'})
  const snapshot={
    companyId:'company-a',revision:'rev-1',generatedAt:new Date().toISOString(),members:[
      {memberId:'member-admin',email:'admin@example.com',name:'Admin',role:'admin',modules:['obra360'],channels:['desktop','mobile'],status:'active'},
      {memberId:'member-user',email:'user@example.com',name:'Engenharia',role:'foreman',modules:['obra360'],channels:['desktop','mobile'],status:'active'}
    ]
  }
  const cloudAuthority={
    async redeemClaim({serverId,claimToken}){
      assert.equal(serverId,'server-flow');assert.equal(claimToken,'cloud-claim')
      return{serverToken:'server-secret',company:{id:'company-a',name:'Empresa A'},claimingMemberId:'member-admin',issuedByDeviceId:'cloud-device-admin',requestingDevice:{installationId:'install-admin'},snapshot}
    },
    async snapshot(){return{snapshot}}
  }
  const pairingService=new PairingService({security,codeFactory:()=> 'PAIR-FLOW1',tokenFactory:()=> 'paired-device-secret'})
  const server=createLanServer({repository,security,identity,cloudAuthority,cloudBaseUrl:'https://cloud.example',pairingService})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address(),base=`http://127.0.0.1:${address.port}`

  try{
    const health=await fetch(base+'/health');assert.deepEqual(await health.json(),{status:'ok',product:'Obra na Mão',apiVersion:'1'})
    const version=await fetch(base+'/version');const versionBody=await version.json();assert.equal(JSON.stringify(versionBody).includes('company-a'),false);assert.equal(JSON.stringify(versionBody).includes('secret'),false)

    const setup=await fetch(base+'/api/v1/setup/status');assert.deepEqual(await setup.json(),{claimed:false,serverId:'server-flow'})
    const claim=await post(base,'/api/v1/setup/claim',{setupCode:'FLOW-CODE',claimToken:'cloud-claim',installationId:'install-admin',deviceName:'PC Principal'})
    assert.equal(claim.status,201)
    const claimBody=await claim.json();const adminToken=claimBody.deviceToken
    assert.ok(adminToken&&adminToken.length>=40);assert.equal(claimBody.device.member.role,'admin')

    const invitation=await post(base,'/api/v1/admin/pairing',{targetMemberId:'user@example.com'},adminToken)
    assert.equal(invitation.status,201)
    const invitationBody=await invitation.json();assert.equal(invitationBody.code,'PAIR-FLOW1');assert.equal(invitationBody.member.memberId,'member-user')

    const paired=await post(base,'/api/v1/pair/claim',{code:'PAIR-FLOW1',installationId:'install-user',deviceName:'PC Engenharia'})
    assert.equal(paired.status,201)
    const pairedBody=await paired.json();const userToken=pairedBody.deviceToken
    assert.equal(userToken,'paired-device-secret');assert.equal(pairedBody.member.memberId,'member-user')

    const empresa=await post(base,'/api/v1/empresas',{razao_social:'Empresa Central',nome_fantasia:'Central',status:'ativa'},userToken)
    assert.equal(empresa.status,201);const empresaBody=await empresa.json();assert.equal(empresaBody.razao_social,'Empresa Central')
    const list=await fetch(base+'/api/v1/empresas',{headers:{authorization:`Bearer ${userToken}`}});assert.equal(list.status,200);assert.equal((await list.json()).length,1)

    const revoke=await fetch(base+`/api/v1/admin/devices/${pairedBody.device.id}`,{method:'PUT',headers:jsonHeaders(adminToken),body:JSON.stringify({status:'revoked'})})
    assert.equal(revoke.status,200);assert.equal((await revoke.json()).device.status,'revoked')
    const denied=await fetch(base+'/api/v1/empresas',{headers:{authorization:`Bearer ${userToken}`}});assert.equal(denied.status,403);assert.equal((await denied.json()).error,'device_revoked')

    const adminStillWorks=await fetch(base+'/api/v1/empresas',{headers:{authorization:`Bearer ${adminToken}`}});assert.equal(adminStillWorks.status,200)
  }finally{await close(server,repository)}
})
