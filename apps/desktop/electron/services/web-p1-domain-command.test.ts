import {test,expect} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const {DatabaseService}=require('./database.cjs'),{applyWebP0Create}=require('./web-p0-create.cjs');
test('Desktop local P1 mantém medição, pedido, recebimento, estoque e contrato idempotentes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p1-domain-'));
 const database=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});database.open();
 try{
  const company=database.save('empresas',{razao_social:'Empresa'}),work=database.save('obras',{empresa_id:company.id,nome:'Obra A'});
  const scope={companyId:company.id,workId:work.id,deviceId:'pc-a'};
  const cmd=(entity:string,id:string,data:any)=>({id,deviceId:'pc-a',entity,action:'create',data});
  const budget=database.save('itens_orcamentarios',{obra_id:work.id,descricao:'PVC',unidade:'m',tipo:'material',quantidade:10,valor_unitario_centavos:1000});
  const measurement=cmd('medicoes','11111111-1111-4111-8111-111111111111',{numero:'M1',competencia:'2026-11',data:'2026-11-22',status:'rascunho',valor_bruto_centavos:2000,valor_liquido_centavos:2000,itens:[{item_orcamentario_id:budget.id,quantidade_periodo:2,valor_periodo_centavos:2000}]});
  const m=applyWebP0Create({database,scope,command:measurement});
  expect(applyWebP0Create({database,scope,command:measurement}).duplicate).toBe(true);
  expect(database.get('medicoes',m.localId).obra_id).toBe(work.id);
  const order=cmd('pedidos_compra','22222222-2222-4222-8222-222222222222',{descricao:'Comprar',valor_centavos:5000,gerar_conta:false,itens:[{descricao:'PVC',unidade:'un',quantidade_pedida:5,valor_centavos:5000}]});
  const saved=applyWebP0Create({database,scope,command:order});
  const item=database.list('pedido_compra_itens',{pedido_compra_id:saved.localId})[0];
  const receipt=cmd('recebimentos_materiais','33333333-3333-4333-8333-333333333333',{pedido_item_id:item.id,quantidade_recebida:3,data:'2026-11-22'});
  applyWebP0Create({database,scope,command:receipt});
  expect(applyWebP0Create({database,scope,command:receipt}).duplicate).toBe(true);
  expect(database.list('movimentacoes_estoque',{obra_id:work.id})).toHaveLength(1);
  const contract=cmd('contratos_obra','44444444-4444-4444-8444-444444444444',{descricao:'Contrato A',valor_centavos:100000,gerar_conta:false});
  const c=applyWebP0Create({database,scope,command:contract});
  expect(applyWebP0Create({database,scope,command:contract})).toMatchObject({duplicate:true,localId:c.localId});
  expect(database.get('contratos_obra',c.localId).obra_id).toBe(work.id);
 }finally{database.close();fs.rmSync(dir,{recursive:true,force:true})}
});