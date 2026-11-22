import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {DatabaseSync}=require('node:sqlite');

const state=vi.hoisted(()=>({env:null as any}));
vi.mock('../cloudflare/sdk',()=>({
 runtimeEnv:()=>state.env,
 db:{
  get:async(collection:string,ids:string[])=>{
   const out:any[]=[];
   for(const id of ids){
    const row=await state.env.DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').bind(collection,id).first();
    if(row)out.push({...JSON.parse(row.record_json),id});
   }
   return out;
  },
  list:async(collection:string,options:any={})=>{
   const result=await state.env.DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT ?').bind(collection,options.limit||100).all();
   return {items:result.results.map((row:any)=>({...JSON.parse(row.record_json),id:row.id}))};
  }
 }
}));
import {enqueueWebP0Command,pendingWebP0Commands,ackWebP0Command,listWebP0Commands} from './web-p0-command-store';

let database:any;
beforeEach(()=>{
 database=new DatabaseSync(':memory:');
 database.exec("CREATE TABLE kv_records(collection TEXT NOT NULL,id TEXT NOT NULL,record_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(collection,id))");
 state.env={DB:{prepare:(sql:string)=>{
   const stmt=database.prepare(sql);let args:any[]=[];
   return {bind(...values:any[]){args=values;return this},
    async run(){const result=stmt.run(...args);return{meta:{changes:result.changes}}},
    async first(){return stmt.get(...args)||null},
    async all(){return{results:stmt.all(...args)}}};
 }}};
});
afterEach(()=>database.close());
const command={commandId:'11111111-1111-4111-8111-111111111111',sourceDeviceId:'desktop-a',entity:'tarefas_obra' as const,data:{titulo:'Comprar tubos'}};
it('enfileira de forma idempotente e entrega somente para o dispositivo vinculado',async()=>{
 const input={projectId:'obra-a',companyId:'empresa-a',actorId:'admin-a',command};
 const first=await enqueueWebP0Command(input),replayed=await enqueueWebP0Command(input);
 expect(first.id).toBe(command.commandId);expect(replayed.status).toBe('pending');
 expect((await pendingWebP0Commands('obra-a','desktop-a'))).toHaveLength(1);
 expect(await pendingWebP0Commands('obra-a','desktop-b')).toHaveLength(0);
 expect(await pendingWebP0Commands('obra-b','desktop-a')).toHaveLength(0);
 expect(await listWebP0Commands('obra-a','admin-b')).toHaveLength(0);
 await expect(enqueueWebP0Command({...input,command:{...command,data:{titulo:'Outro'}}})).rejects.toThrow();
});
it('confirma uma vez, resiste a ACK repetido e não reenvia comando aplicado',async()=>{
 const input={projectId:'obra-a',companyId:'empresa-a',actorId:'admin-a',command};
 await enqueueWebP0Command(input);
 await expect(ackWebP0Command('obra-a','desktop-b',{commandId:command.commandId,entity:'tarefas_obra',localId:99})).rejects.toThrow();
 expect((await ackWebP0Command('obra-a','desktop-a',{commandId:command.commandId,entity:'tarefas_obra',localId:42}))?.status).toBe('applied');
 expect((await ackWebP0Command('obra-a','desktop-a',{commandId:command.commandId,entity:'tarefas_obra',localId:99}))?.localId).toBe(42);
 expect(await pendingWebP0Commands('obra-a','desktop-a')).toHaveLength(0);
 expect((await enqueueWebP0Command(input)).status).toBe('applied');
});
