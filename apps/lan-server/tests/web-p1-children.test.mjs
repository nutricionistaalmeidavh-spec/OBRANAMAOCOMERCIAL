import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
import {LanRepository} from '../src/repository.mjs';
import {p1ChildRows} from '../src/web-p1-children.mjs';
test('P1 lists only child records of the selected work (no cross-work leakage)',()=>{
 const repo=new LanRepository({filename:':memory:'});repo.applyMigrations(path.resolve(import.meta.dirname,'../migrations'));
 try{
  const company=repo.save('empresas',{razao_social:'Empresa'});
  const a=repo.save('obras',{empresa_id:company.id,nome:'A'}),b=repo.save('obras',{empresa_id:company.id,nome:'B'});
  const orderA=repo.save('pedidos_compra',{obra_id:a.id,descricao:'Pedido A'});
  const orderB=repo.save('pedidos_compra',{obra_id:b.id,descricao:'Pedido B'});
  const itemA=repo.save('pedido_compra_itens',{pedido_compra_id:orderA.id,descricao:'Tubo',unidade:'m',quantidade_pedida:10});
  repo.save('pedido_compra_itens',{pedido_compra_id:orderB.id,descricao:'Outro',unidade:'m',quantidade_pedida:10});
  const rows=p1ChildRows(repo,'pedido_compra_itens',a.id);
  assert.deepEqual(rows.map(r=>r.id),[itemA.id]);
  assert.throws(()=>p1ChildRows(repo,'contas',a.id));
  assert.throws(()=>p1ChildRows(repo,'pedido_compra_itens',0));
 }finally{repo.close()}
});