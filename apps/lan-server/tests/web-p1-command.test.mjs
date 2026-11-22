import test from 'node:test';import assert from 'node:assert/strict';
import path from 'node:path';
import {LanRepository} from '../src/repository.mjs';
import {applyLanWebP0Command} from '../src/web-p0-command-service.mjs';
test('P1 no servidor próprio aplica RDO/checklist uma só vez e impede etapa de outra obra',()=>{
 const repository=new LanRepository({filename:':memory:'});
 repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'));
 try{
  const company=repository.save('empresas',{razao_social:'Empresa'});
  const work=repository.save('obras',{empresa_id:company.id,nome:'Obra'});
  const other=repository.save('obras',{empresa_id:company.id,nome:'Outra'});
  const stage=repository.save('frentes_obra',{obra_id:work.id,nome:'Frente'});
  const foreign=repository.save('frentes_obra',{obra_id:other.id,nome:'Fora'});
  const scope={companyId:company.id,workId:work.id,deviceId:'desktop-a'};
  const cmd={id:'11111111-1111-4111-8111-111111111111',deviceId:'desktop-a',entity:'checklist_frente_itens',action:'create',data:{frente_id:stage.id,descricao:'Vistoria'}};
  const a=applyLanWebP0Command({repository,scope,command:cmd}),b=applyLanWebP0Command({repository,scope,command:cmd});
  assert.equal(b.duplicate,true);assert.equal(a.localId,b.localId);
  assert.equal(repository.get('checklist_frente_itens',a.localId).obra_id,work.id);
  assert.throws(()=>applyLanWebP0Command({repository,scope,command:{...cmd,id:'22222222-2222-4222-8222-222222222222',data:{frente_id:foreign.id,descricao:'Invasão'}}}));
  const rdo=applyLanWebP0Command({repository,scope,command:{...cmd,id:'33333333-3333-4333-8333-333333333333',entity:'rdos',data:{data:'2026-11-21'}}});
  assert.equal(repository.get('rdos',rdo.localId).data,'2026-11-21');
 }finally{repository.close()}
});