import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
import {LanRepository} from '../src/repository.mjs';
import {applyLanWebP0Command} from '../src/web-p0-command-service.mjs';
const cmd=(entity,id,data)=>({id,entity,action:'create',deviceId:'pc-a',data});
function fixture(){
 const repository=new LanRepository({filename:':memory:'});repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'));
 const company=repository.save('empresas',{razao_social:'Empresa'});
 const work=repository.save('obras',{empresa_id:company.id,nome:'Obra A'});
 const foreign=repository.save('obras',{empresa_id:company.id,nome:'Obra B'});
 const scope={companyId:company.id,workId:work.id,deviceId:'pc-a'};
 return{repository,company,work,foreign,scope};
}
test('P1 medição transacional é idempotente, não excede orçamento nem mede item de outra obra',()=>{
 const f=fixture();try{
  const budget=f.repository.save('itens_orcamentarios',{obra_id:f.work.id,descricao:'PVC',unidade:'m',tipo:'material',quantidade:10,valor_unitario_centavos:1000});
  const other=f.repository.save('itens_orcamentarios',{obra_id:f.foreign.id,descricao:'Cobre',unidade:'m',tipo:'material',quantidade:5,valor_unitario_centavos:1000});
  const data={numero:'M01',competencia:'2026-11',data:'2026-11-22',status:'rascunho',retencoes_centavos:0,descontos_centavos:0,valor_bruto_centavos:2000,valor_liquido_centavos:2000,itens:[{item_orcamentario_id:budget.id,quantidade_periodo:2,valor_periodo_centavos:2000}]};
  const c=cmd('medicoes','11111111-1111-4111-8111-111111111111',data);
  const a=applyLanWebP0Command({repository:f.repository,scope:f.scope,command:c}),b=applyLanWebP0Command({repository:f.repository,scope:f.scope,command:c});
  assert.equal(b.duplicate,true);assert.equal(a.localId,b.localId);
  assert.equal(f.repository.list('medicao_itens',{medicao_id:a.localId}).length,1);
  assert.throws(()=>applyLanWebP0Command({repository:f.repository,scope:f.scope,command:{...c,id:'22222222-2222-4222-8222-222222222222',data:{...data,numero:'M02',itens:[{item_orcamentario_id:other.id,quantidade_periodo:1,valor_periodo_centavos:1000}]}}}));
 }finally{f.repository.close()}
});
test('P1 ordem, recebimento e saída não duplicam estoque, rejeitam outra obra e saldo negativo',()=>{
 const f=fixture();try{
  const order=applyLanWebP0Command({repository:f.repository,scope:f.scope,command:cmd('pedidos_compra','33333333-3333-4333-8333-333333333333',{descricao:'Tubos',status:'emitido',valor_centavos:5000,gerar_conta:false,itens:[{descricao:'PVC',unidade:'un',quantidade_pedida:5,valor_centavos:5000}]})});
  const item=f.repository.list('pedido_compra_itens',{pedido_compra_id:order.localId})[0];
  const receive=cmd('recebimentos_materiais','44444444-4444-4444-8444-444444444444',{pedido_item_id:item.id,quantidade_recebida:3,data:'2026-11-22'});
  const a=applyLanWebP0Command({repository:f.repository,scope:f.scope,command:receive});
  assert.equal(applyLanWebP0Command({repository:f.repository,scope:f.scope,command:receive}).duplicate,true);
  assert.equal(f.repository.list('movimentacoes_estoque',{obra_id:f.work.id}).length,1);
  assert.equal(f.repository.get('pedido_compra_itens',item.id).quantidade_recebida,3);
  assert.throws(()=>applyLanWebP0Command({repository:f.repository,scope:f.scope,command:cmd('movimentacoes_estoque','55555555-5555-4555-8555-555555555555',{tipo:'saida',descricao:'PVC',unidade:'un',quantidade:4,data:'2026-11-22'})}));
  const foreign=f.repository.save('pedidos_compra',{obra_id:f.foreign.id,descricao:'Outra obra',valor_centavos:1});
  const foreignItem=f.repository.save('pedido_compra_itens',{pedido_compra_id:foreign.id,descricao:'Alheio',unidade:'un',quantidade_pedida:10});
  assert.throws(()=>applyLanWebP0Command({repository:f.repository,scope:f.scope,command:cmd('recebimentos_materiais','66666666-6666-4666-8666-666666666666',{pedido_item_id:foreignItem.id,quantidade_recebida:1,data:'2026-11-22'})}));
 }finally{f.repository.close()}
});
test('P1 contrato e aditivo solicitado são idempotentes e isolados por obra',()=>{
 const f=fixture();try{
  const c=cmd('contratos_obra','77777777-7777-4777-8777-777777777777',{descricao:'Instalação hidráulica',valor_centavos:100000,status:'ativo',gerar_conta:false});
  const first=applyLanWebP0Command({repository:f.repository,scope:f.scope,command:c});
  assert.equal(applyLanWebP0Command({repository:f.repository,scope:f.scope,command:c}).duplicate,true);
  const add=cmd('contrato_aditivos','88888888-8888-4888-8888-888888888888',{contrato_id:first.localId,descricao:'Aditivo',valor_centavos:1000,status:'solicitado'});
  const result=applyLanWebP0Command({repository:f.repository,scope:f.scope,command:add});
  assert.equal(applyLanWebP0Command({repository:f.repository,scope:f.scope,command:add}).duplicate,true);
  assert.equal(f.repository.get('contrato_aditivos',result.localId).contrato_id,first.localId);
  const other=f.repository.save('contratos_obra',{obra_id:f.foreign.id,descricao:'Contrato externo',valor_centavos:500});
  assert.throws(()=>applyLanWebP0Command({repository:f.repository,scope:f.scope,command:cmd('contrato_aditivos','99999999-9999-4999-8999-999999999999',{contrato_id:other.id,descricao:'Inválido',valor_centavos:1,status:'solicitado'})}));
 }finally{f.repository.close()}
});