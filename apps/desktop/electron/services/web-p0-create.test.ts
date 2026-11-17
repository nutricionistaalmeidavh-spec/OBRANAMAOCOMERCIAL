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
