import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {afterEach,expect,it} from 'vitest';
const require=createRequire(import.meta.url);
const {DatabaseService}=require('./database.cjs');
const {applyWebP0Create}=require('./web-p0-create.cjs');
const fixtures:any[]=[];
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0-web-create-'));
 const database=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});
 database.open();
 const company=database.save('empresas',{razao_social:'Empresa A',status:'ativa'});
 const obra=database.save('obras',{empresa_id:company.id,nome:'Obra A'});
 const other=database.save('obras',{empresa_id:company.id,nome:'Obra B'});
 const stage=database.save('frentes_obra',{obra_id:obra.id,nome:'Hidráulica'});
 const otherStage=database.save('frentes_obra',{obra_id:other.id,nome:'Outra etapa'});
 const result={dir,database,company,obra,other,stage,otherStage};
 fixtures.push(result);return result;
}
afterEach(()=>{for(const f of fixtures.splice(0)){f.database.close();fs.rmSync(f.dir,{recursive:true,force:true})}});
const cmd=(id:string,entity:string,data:any)=>({id,entity,deviceId:'desktop-a',data});
it('cria etapa uma única vez mesmo se o comando voltar após falha de confirmação',()=>{
 const f=fixture(),scope={companyId:f.company.id,workId:f.obra.id,deviceId:'desktop-a'};
 const command=cmd('11111111-1111-4111-8111-111111111111','frentes_obra',{nome:'Elétrica'});
 const first=applyWebP0Create({database:f.database,scope,command}),second=applyWebP0Create({database:f.database,scope,command});
 expect(first).toMatchObject({entity:'frentes_obra',duplicate:false});
 expect(second).toMatchObject({entity:'frentes_obra',duplicate:true,localId:first.localId});
 expect(f.database.list('frentes_obra',{obra_id:f.obra.id}).filter((x:any)=>x.nome==='Elétrica')).toHaveLength(1);
});
it('cria subetapa sob etapa da mesma obra e bloqueia vínculo com outra obra',()=>{
 const f=fixture(),scope={companyId:f.company.id,workId:f.obra.id,deviceId:'desktop-a'};
 const first=applyWebP0Create({database:f.database,scope,command:cmd('22222222-2222-4222-8222-222222222222','subfrentes_obra',{nome:'Prumadas',frente_id:f.stage.id})});
 expect(f.database.get('subfrentes_obra',first.localId)).toMatchObject({obra_id:f.obra.id,frente_id:f.stage.id,nome:'Prumadas'});
 expect(()=>applyWebP0Create({database:f.database,scope,command:cmd('33333333-3333-4333-8333-333333333333','subfrentes_obra',{nome:'Inválida',frente_id:f.otherStage.id})})).toThrow();
});
it('protege a obra do comando e detecta repetição com payload alterado',()=>{
 const f=fixture(),scope={companyId:f.company.id,workId:f.obra.id,deviceId:'desktop-a'};
 const command=cmd('44444444-4444-4444-8444-444444444444','tarefas_obra',{titulo:'Comprar tubos'});
 const saved=applyWebP0Create({database:f.database,scope,command});
 expect(f.database.get('tarefas_obra',saved.localId)).toMatchObject({obra_id:f.obra.id,titulo:'Comprar tubos'});
 expect(()=>applyWebP0Create({database:f.database,scope,command:{...command,data:{titulo:'Diferente'}}})).toThrow();
 expect(()=>applyWebP0Create({database:f.database,scope:{...scope,workId:f.other.id},command})).toThrow();
});

it('cria cliente e nova obra usando empresa e cliente da mesma fonte',()=>{
 const f=fixture(),scope={companyId:f.company.id,workId:f.obra.id,deviceId:'desktop-a'};
 const client=applyWebP0Create({database:f.database,scope,command:cmd('55555555-5555-4555-8555-555555555555','clientes',{nome:'Cliente Novo'})});
 expect(f.database.get('clientes',client.localId)).toMatchObject({empresa_id:f.company.id,nome:'Cliente Novo'});
 const work=applyWebP0Create({database:f.database,scope,command:cmd('66666666-6666-4666-8666-666666666666','obras',{nome:'Obra Nova',cliente_id:client.localId})});
 expect(f.database.get('obras',work.localId)).toMatchObject({empresa_id:f.company.id,cliente_id:client.localId,nome:'Obra Nova'});
 const otherCompany=f.database.save('empresas',{razao_social:'Empresa externa',status:'ativa'});
 const foreign=f.database.save('clientes',{empresa_id:otherCompany.id,nome:'Cliente externo'});
 expect(()=>applyWebP0Create({database:f.database,scope,command:cmd('77777777-7777-4777-8777-777777777777','obras',{nome:'Não pode',cliente_id:foreign.id})})).toThrow();
});
it('exclui logicamente uma tarefa apenas se o hash coincidir, sem afetar outra obra',()=>{
 const { webP0Fingerprint }=require('./web-p0-create.cjs');
 const f=fixture(),scope={companyId:f.company.id,workId:f.obra.id,deviceId:'desktop-a'};
 const task=f.database.save('tarefas_obra',{obra_id:f.obra.id,titulo:'Conferir'});
 const stale='a'.repeat(64),row=f.database.get('tarefas_obra',task.id);
 const command={id:'88888888-8888-4888-8888-888888888888',entity:'tarefas_obra',deviceId:'desktop-a',action:'delete',localId:task.id,expectedFingerprint:stale,data:{}};
 expect(()=>applyWebP0Create({database:f.database,scope,command})).toThrow();
 const deleted=applyWebP0Create({database:f.database,scope,command:{...command,expectedFingerprint:webP0Fingerprint(row)}});
 expect(deleted).toMatchObject({action:'delete',localId:task.id});
 expect(f.database.get('tarefas_obra',task.id).deleted_at).toBeTruthy();
 expect(applyWebP0Create({database:f.database,scope,command:{...command,expectedFingerprint:webP0Fingerprint(row)}}).duplicate).toBe(true);
 const otherTask=f.database.save('tarefas_obra',{obra_id:f.other.id,titulo:'Outra obra'});
 expect(()=>applyWebP0Create({database:f.database,scope,command:{...command,id:'99999999-9999-4999-8999-999999999999',localId:otherTask.id,expectedFingerprint:webP0Fingerprint(f.database.get('tarefas_obra',otherTask.id))}})).toThrow();
});
it('recusa exclusão de etapa com dependências e da obra ativa',()=>{
 const { webP0Fingerprint }=require('./web-p0-create.cjs');
 const f=fixture(),scope={companyId:f.company.id,workId:f.obra.id,deviceId:'desktop-a'};
 f.database.save('subfrentes_obra',{obra_id:f.obra.id,frente_id:f.stage.id,nome:'Subetapa'});
 const stageCmd={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',entity:'frentes_obra',deviceId:'desktop-a',action:'delete',localId:f.stage.id,data:{},expectedFingerprint:webP0Fingerprint(f.database.get('frentes_obra',f.stage.id))};
 expect(()=>applyWebP0Create({database:f.database,scope,command:stageCmd})).toThrow(/dependência/i);
 const workCmd={...stageCmd,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',entity:'obras',localId:f.obra.id,expectedFingerprint:webP0Fingerprint(f.database.get('obras',f.obra.id))};
 expect(()=>applyWebP0Create({database:f.database,scope,command:workCmd})).toThrow();
});
