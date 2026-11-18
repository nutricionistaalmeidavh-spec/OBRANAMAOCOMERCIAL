import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import { LanRepository } from '../src/repository.mjs';
import { createLanServer } from '../src/server.mjs';
import { webP0Fingerprint } from '../src/web-p0-command-service.mjs';

const TOKEN='web-p0-lan-test-token';
const digest=v=>createHash('sha256').update(v).digest('hex');
function security(role='admin'){
 return{
  serverState(){return{claimed:true,companyId:'cloud-company-A'}},
  deviceByTokenHash(v){return v===digest(TOKEN)?{id:'lan-device-A',memberId:'user-A',status:'active'}:null},
  member(){return{memberId:'user-A',role,modules:['obra360'],channels:['desktop'],status:'active'}},
  touchDevice(){}
 }
}
async function fixture(role='admin'){
 const repository=new LanRepository({filename:':memory:'});
 repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'));
 const company=repository.save('empresas',{razao_social:'Empresa A'});
 const work=repository.save('obras',{empresa_id:company.id,nome:'Obra A'});
 const server=createLanServer({repository,security:security(role)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return{repository,company,work,server,url:'http://127.0.0.1:'+server.address().port};
}
async function close(f){f.server.close();await once(f.server,'close');f.repository.close()}
async function send(f,scope,command,token=TOKEN){
 const r=await fetch(f.url+'/api/v1/web-p0/commands',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({scope,command})});
 return{status:r.status,body:await r.json()};
}
const id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
test('Servidor LAN confirma criação idempotente de cliente, obra e subetapa na fonte operacional',async()=>{
 const f=await fixture();
 try{
  const scope={companyId:f.company.id,workId:f.work.id,remoteCompanyId:'cloud-company-A',deviceId:'cloud-device-A'};
  const client={id,entity:'clientes',deviceId:scope.deviceId,action:'create',data:{nome:'Cliente criado pela Web'}};
  const first=await send(f,scope,client),again=await send(f,scope,client);
  assert.equal(first.status,200);assert.equal(again.status,200);
  assert.equal(first.body.localId,again.body.localId);
  assert.equal(again.body.duplicate,true);
  assert.equal(f.repository.list('clientes',{empresa_id:f.company.id}).length,1);
  const newWork=await send(f,scope,{...client,id:'ffffffff-ffff-4fff-8fff-ffffffffffff',entity:'obras',data:{nome:'Obra Nova',cliente_id:first.body.localId}});
  assert.equal(newWork.status,200);
  assert.equal(f.repository.get('obras',newWork.body.localId).empresa_id,f.company.id);
  const front=f.repository.save('frentes_obra',{obra_id:f.work.id,nome:'Hidráulica'});
  const sub=await send(f,scope,{...client,id:'11111111-aaaa-4aaa-8aaa-111111111111',entity:'subfrentes_obra',data:{nome:'Prumadas',frente_id:front.id}});
  assert.equal(sub.status,200);assert.equal(f.repository.get('subfrentes_obra',sub.body.localId).frente_id,front.id);
 }finally{await close(f)}
});
test('Servidor LAN rejeita falso tenant, colaborador, dispositivo e exclusão de etapa em uso',async()=>{
 const f=await fixture();
 try{
  const scope={companyId:f.company.id,workId:f.work.id,remoteCompanyId:'cloud-company-A',deviceId:'cloud-device-A'};
  const cmd={id,entity:'frentes_obra',deviceId:scope.deviceId,action:'create',data:{nome:'Hidráulica'}};
  assert.equal((await send(f,{...scope,remoteCompanyId:'cloud-company-B'},cmd)).status,403);
  assert.equal((await send(f,scope,cmd,'wrong-token')).status,401);
  const created=await send(f,scope,cmd);assert.equal(created.status,200);
  const row=f.repository.get('frentes_obra',created.body.localId);
  f.repository.save('subfrentes_obra',{obra_id:f.work.id,frente_id:row.id,nome:'Prumada'});
  const deletion={id:'22222222-bbbb-4bbb-8bbb-222222222222',entity:'frentes_obra',deviceId:scope.deviceId,action:'delete',localId:row.id,expectedFingerprint:webP0Fingerprint({...row,revision:1}),data:{}};
  assert.equal((await send(f,scope,deletion)).status,409);
 }finally{await close(f)}
 const denied=await fixture('employee');
 try{const scope={companyId:denied.company.id,workId:denied.work.id,remoteCompanyId:'cloud-company-A',deviceId:'cloud-device-A'};
 assert.equal((await send(denied,scope,{id,entity:'clientes',deviceId:scope.deviceId,action:'create',data:{nome:'Bloqueado'}})).status,403)}
 finally{await close(denied)}
});
