import {test,expect} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const {DatabaseService}=require('./database.cjs'),{applyWebP0Create}=require('./web-p0-create.cjs');
test('criar orçamento e solicitação no SQLite é idempotente, sem criar contas/movimentação de estoque',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p1-economic-'));
 const database=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});database.open();
 try{
  const company=database.save('empresas',{razao_social:'Empresa'}),work=database.save('obras',{empresa_id:company.id,nome:'Obra'});
  const scope={companyId:company.id,workId:work.id,deviceId:'pc-a'};
  const cmd={id:'11111111-1111-4111-8111-111111111111',deviceId:'pc-a',entity:'itens_orcamentarios',data:{descricao:'Tubulação',tipo:'material',unidade:'m',quantidade:10,valor_unitario_centavos:1299}};
  const a=applyWebP0Create({database,scope,command:cmd});
  expect(applyWebP0Create({database,scope,command:cmd})).toMatchObject({duplicate:true,localId:a.localId});
  expect(database.get('itens_orcamentarios',a.localId)).toMatchObject({quantidade:10,valor_unitario_centavos:1299,obra_id:work.id});
  const req={...cmd,id:'22222222-2222-4222-8222-222222222222',entity:'solicitacoes_compra',data:{descricao:'Comprar tubos',solicitante:'João'}};
  const b=applyWebP0Create({database,scope,command:req});
  expect(database.get('solicitacoes_compra',b.localId)).toMatchObject({obra_id:work.id,solicitante:'João'});
  expect(database.list('contas',{obra_id:work.id})).toHaveLength(0);
  expect(database.list('movimentacoes_estoque',{obra_id:work.id})).toHaveLength(0);
 }finally{database.close();fs.rmSync(dir,{recursive:true,force:true})}
});