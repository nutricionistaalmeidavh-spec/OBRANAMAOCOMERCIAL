import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {DatabaseSync}=require('node:sqlite');
const state=vi.hoisted(()=>({env:null as any}));
vi.mock('../cloudflare/sdk',()=>({
 runtimeEnv:()=>state.env,
 db:{
  get:async(collection:string,ids:string[])=>{
   const out=[];
   for(const id of ids){const row=await state.env.DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').bind(collection,id).first();if(row)out.push({...JSON.parse(row.record_json),id})}
   return out;
  },
  list:async(collection:string,{limit=100}:any={})=>{
   const result=await state.env.DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT ?').bind(collection,limit).all();
   return{items:result.results.map((row:any)=>({...JSON.parse(row.record_json),id:row.id}))};
  },
  add:async(collection:string,records:Record<string,unknown>[])=>{
   const ids=[];
   for(const record of records){
    const id=String(records.length)+'_'+Math.random().toString(16).slice(2);
    await state.env.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
     .bind(collection,id,JSON.stringify(record),'2026-11-18','2026-11-18').run();
    ids.push(id);
   }
   return ids;
  }
 }
}));
import {ensureP0WorkProject,p0ProjectId} from './web-p0-project-provision';

let database:any;
beforeEach(()=>{
 database=new DatabaseSync(':memory:');
 database.exec("CREATE TABLE kv_records(collection TEXT NOT NULL,id TEXT NOT NULL,record_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(collection,id))");
 state.env={DB:{prepare:(sql:string)=>{
   const stmt=database.prepare(sql);let args:any[]=[];
   return{bind(...values:any[]){args=values;return this},
    async run(){const result=stmt.run(...args);return{meta:{changes:result.changes}}},
    async first(){return stmt.get(...args)||null},
    async all(){return{results:stmt.all(...args)}}};
 }}};
 database.prepare("INSERT INTO kv_records VALUES(?,?,?,?,?)").run('projects','project-a',JSON.stringify({companyId:'company-a',name:'Obra principal'}),'2026-11-18','2026-11-18');
});
afterEach(()=>database.close());
const input={commandId:'abababab-abab-4aba-8aba-abababababab',companyId:'company-a',parentProjectId:'project-a',actorId:'admin-a',sourceDeviceId:'desktop-a',localWorkId:81,name:'Nova obra',maxProjects:2};
describe('provisionamento automático e idempotente da obra no Web',()=>{
 it('ID determinístico para retry após falha de ACK',()=>{
  expect(p0ProjectId(input.commandId)).toBe('p0work_abababababab4aba8abaabababababab');
 });
 it('cria projeto do mesmo tenant e estado inicial sem copiar o banco operacional',async()=>{
  const first=await ensureP0WorkProject(input);
  const replay=await ensureP0WorkProject(input);
  expect(first.id).toBe(replay.id);
  expect(database.prepare("SELECT COUNT(*) n FROM kv_records WHERE collection='projects'").get().n).toBe(2);
  const row=database.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').get('projects',first.id);
  expect(JSON.parse(row.record_json).workSource).toEqual({sourceDeviceId:'desktop-a',localWorkId:81,parentProjectId:'project-a'});
  expect(database.prepare("SELECT COUNT(*) n FROM kv_records WHERE collection=?").get('project_meta_'+first.id).n).toBe(1);
 });
 it('rejeita quota e nova obra de outro tenant sem provisão parcial',async()=>{
  await expect(ensureP0WorkProject({...input,maxProjects:1})).rejects.toThrow(/Limite de projetos/);
  await expect(ensureP0WorkProject({...input,companyId:'company-b'})).rejects.toThrow();
  expect(database.prepare("SELECT COUNT(*) n FROM kv_records WHERE collection='projects'").get().n).toBe(1);
 });
 it('rejeita reaproveitar UUID com outro ID operacional',async()=>{
  await ensureP0WorkProject(input);
  await expect(ensureP0WorkProject({...input,localWorkId:999})).rejects.toThrow(/Conflito/);
 });
});
