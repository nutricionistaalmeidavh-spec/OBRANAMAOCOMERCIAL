import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
import {LanRepository} from '../src/repository.mjs';
import {applyLanWebP0Command} from '../src/web-p0-command-service.mjs';
test('orçamento e solicitação de compras P1 preservam fontes canônicas e não geram contas/estoque',()=>{
 const repository=new LanRepository({filename:':memory:'});repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'));
 try{
  const company=repository.save('empresas',{razao_social:'Empresa'});
  const work=repository.save('obras',{empresa_id:company.id,nome:'Obra A'});
  const other=repository.save('obras',{empresa_id:company.id,nome:'Obra B'});
  const foreign=repository.save('frentes_obra',{obra_id:other.id,nome:'Elétrica'});
  const scope={companyId:company.id,workId:work.id,deviceId:'pc-1'};
  const command={id:'11111111-1111-4111-8111-111111111111',entity:'itens_orcamentarios',action:'create',deviceId:'pc-1',data:{descricao:'Tubo',unidade:'m',tipo:'material',quantidade:10.5,valor_unitario_centavos:990}};
  const a=applyLanWebP0Command({repository,scope,command}),b=applyLanWebP0Command({repository,scope,command});
  assert.equal(b.duplicate,true);assert.equal(a.localId,b.localId);
  assert.equal(repository.get('itens_orcamentarios',a.localId).obra_id,work.id);
  assert.throws(()=>applyLanWebP0Command({repository,scope,command:{...command,id:'22222222-2222-4222-8222-222222222222',data:{...command.data,frente_id:foreign.id}}}));
  const request=applyLanWebP0Command({repository,scope,command:{...command,id:'33333333-3333-4333-8333-333333333333',entity:'solicitacoes_compra',data:{descricao:'Solicitar tubos',solicitante:'João'}}});
  assert.equal(repository.get('solicitacoes_compra',request.localId).obra_id,work.id);
  assert.equal(repository.list('contas',{obra_id:work.id}).length,0);
  assert.equal(repository.list('movimentacoes_estoque',{obra_id:work.id}).length,0);
 }finally{repository.close()}
});