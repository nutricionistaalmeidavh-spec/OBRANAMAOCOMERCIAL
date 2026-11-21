import {test,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {DatabaseService}=require('./database.cjs');
const {applyWebP0Create}=require('./web-p0-create.cjs');
test('checklist e RDO P1 são idempotentes, por obra, com validação de frente',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-web-p1-'));
 const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});
 db.open();
 try{
  const company=db.save('empresas',{razao_social:'Empresa'});
  const work=db.save('obras',{empresa_id:company.id,nome:'Minha obra'});
  const other=db.save('obras',{empresa_id:company.id,nome:'Outra obra'});
  const stage=db.save('frentes_obra',{obra_id:work.id,nome:'Hidráulica'});
  const foreign=db.save('frentes_obra',{obra_id:other.id,nome:'Elétrica'});
  const scope={companyId:company.id,workId:work.id,deviceId:'pc-a'};
  const cmd={id:'11111111-1111-4111-8111-111111111111',deviceId:'pc-a',entity:'checklist_frente_itens',data:{frente_id:stage.id,descricao:'Verificar pressão'}};
  const created=applyWebP0Create({database:db,scope,command:cmd});
  expect(created.localId).toBeGreaterThan(0);
  expect(applyWebP0Create({database:db,scope,command:cmd})).toMatchObject({duplicate:true,localId:created.localId});
  expect(db.get('checklist_frente_itens',created.localId)).toMatchObject({obra_id:work.id,frente_id:stage.id});
  expect(()=>applyWebP0Create({database:db,scope,command:{...cmd,id:'22222222-2222-4222-8222-222222222222',data:{frente_id:foreign.id,descricao:'X'}}})).toThrow();
  const report={...cmd,id:'33333333-3333-4333-8333-333333333333',entity:'rdos',data:{data:'2026-11-21',clima:'Sol'}};
  const saved=applyWebP0Create({database:db,scope,command:report});
  expect(db.get('rdos',saved.localId)).toMatchObject({obra_id:work.id,data:'2026-11-21'});
  expect(applyWebP0Create({database:db,scope,command:report}).duplicate).toBe(true);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
});