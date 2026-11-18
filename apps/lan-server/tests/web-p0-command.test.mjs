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


test('LAN atualiza cliente e empresa dentro do tenant e rejeita revisão obsoleta',async()=>{
 const f=await fixture();
 try{
  const scope={companyId:f.company.id,workId:f.work.id,remoteCompanyId:'cloud-company-A',deviceId:'cloud-device-A'};
  const customer=f.repository.save('clientes',{empresa_id:f.company.id,nome:'Cliente anterior'});
  const original=webP0Fingerprint({...customer,revision:1});
  const command={id:'33333333-aaaa-4aaa-8aaa-333333333333',entity:'clientes',deviceId:scope.deviceId,action:'update',localId:customer.id,expectedFingerprint:original,data:{nome:'Cliente atualizado'}};
  const applied=await send(f,scope,command);
  assert.equal(applied.status,200,JSON.stringify(applied.body));
  assert.equal(f.repository.get('clientes',customer.id).nome,'Cliente atualizado');
  const replay=await send(f,scope,command);
  assert.equal(replay.status,200);assert.equal(replay.body.duplicate,true);
  const stale=await send(f,scope,{...command,id:'44444444-aaaa-4aaa-8aaa-444444444444'});
  assert.equal(stale.status,409);
  assert.equal(f.repository.list('clientes',{empresa_id:f.company.id}).length,1);
  const companyCmd={id:'55555555-aaaa-4aaa-8aaa-555555555555',entity:'empresas',deviceId:scope.deviceId,action:'update',localId:f.company.id,expectedFingerprint:webP0Fingerprint({...f.repository.get('empresas',f.company.id),revision:1}),data:{nome_fantasia:'Construtora'}};
  const companyUpdate=await send(f,scope,companyCmd);
  assert.equal(companyUpdate.status,200,JSON.stringify(companyUpdate.body));
  assert.equal(f.repository.get('empresas',f.company.id).nome_fantasia,'Construtora');
  assert.equal((await send(f,scope,{...companyCmd,id:'66666666-aaaa-4aaa-8aaa-666666666666',action:'delete',data:{}})).status,409);
 }finally{await close(f)}
});
test('LAN cria etapa planejada vinculada e prazo, preservando integridade ao rejeitar cruzamento',async()=>{
 const f=await fixture();
 try{
  const scope={companyId:f.company.id,workId:f.work.id,remoteCompanyId:'cloud-company-A',deviceId:'cloud-device-A'};
  const stage=f.repository.save('frentes_obra',{obra_id:f.work.id,nome:'Hidráulica'});
  const plan=await send(f,scope,{id:'77777777-aaaa-4aaa-8aaa-777777777777',entity:'etapas_obra',deviceId:scope.deviceId,action:'create',data:{nome:'Etapa 1',frente_id:stage.id}});
  assert.equal(plan.status,200,JSON.stringify(plan.body));
  const schedule=await send(f,scope,{id:'88888888-aaaa-4aaa-8aaa-888888888888',entity:'cronograma_etapas',deviceId:scope.deviceId,action:'create',data:{nome:'Pressurização',frente_id:stage.id,etapa_id:plan.body.localId,previsto_fim:'2026-11-30'}});
  assert.equal(schedule.status,200,JSON.stringify(schedule.body));
  assert.equal(f.repository.get('cronograma_etapas',schedule.body.localId).etapa_id,plan.body.localId);
  const second=f.repository.save('obras',{empresa_id:f.company.id,nome:'Outra obra'});
  const foreignStage=f.repository.save('frentes_obra',{obra_id:second.id,nome:'Outra etapa'});
  const invalid=await send(f,scope,{id:'99999999-aaaa-4aaa-8aaa-999999999999',entity:'cronograma_etapas',deviceId:scope.deviceId,action:'create',data:{nome:'Outra',frente_id:foreignStage.id}});
  assert.equal(invalid.status,409);
  assert.equal(f.repository.list('cronograma_etapas',{obra_id:f.work.id}).length,1);
 }finally{await close(f)}
});
