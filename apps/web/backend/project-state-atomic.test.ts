import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

const store=vi.hoisted(()=>({DB:null as any}));
vi.mock('../cloudflare/sdk',()=>{
  const list=async(collection:string,options:{limit?:number}={})=>{const rows=await store.DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT ?').bind(collection,options.limit||100).all();return{items:rows.results.map((r:any)=>({...JSON.parse(r.record_json),id:r.id}))}};
  return{
    runtimeEnv:()=>({DB:store.DB}),
    db:{list,
      async add(collection:string,records:any[]){const ids:string[]=[];for(const r of records){const id=crypto.randomUUID(),clean={...r};delete clean.id;await store.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)').bind(collection,id,JSON.stringify(clean),'t','t').run();ids.push(id)}return ids},
      async update(collection:string,changes:any[]){for(const c of changes){const clean={...c.record};delete clean.id;await store.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json').bind(collection,c.id,JSON.stringify(clean),'t','t').run()}return changes.map((c:any)=>c.id)},
    },
  };
});
import { assembleState, saveSnapshot, SnapshotRevisionConflict } from './project-state';

const require=createRequire(import.meta.url);
const {DatabaseSync}=require('node:sqlite');
class TestDB{
  db=new DatabaseSync(':memory:');
  constructor(){const dir=new URL('../cloudflare/migrations/',import.meta.url);for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())this.db.exec(readFileSync(new URL(name,dir),'utf8'))}
  prepare(sql:string){const db=this.db;const stmt=(args:any[]=[])=>({bind:(...values:any[])=>stmt(values.map(v=>v===undefined?null:v)),first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),execute:()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});return stmt()}
  async batch(statements:any[]){this.db.exec('BEGIN');try{const results=statements.map(s=>s.execute());this.db.exec('COMMIT');return results}catch(e){this.db.exec('ROLLBACK');throw e}}
}
beforeEach(()=>{store.DB=new TestDB()});

it('a lost race writes nothing: the winner keeps its floors and days',async()=>{
  await saveSnapshot('p',{project:{name:'Obra'},floors:[{number:0,stages:[]}],days:{'2026-11-25':{note:'base'}}},'admin');
  const base:any=await assembleState('p');
  await saveSnapshot('p',{...base,floors:[{number:0,stages:['winner']}],days:{'2026-11-25':{note:'vencedor'}}},'a');
  await expect(saveSnapshot('p',{...base,floors:[{number:0,stages:['loser']}],days:{'2026-11-25':{note:'perdedor'},'2026-11-26':{note:'novo dia perdedor'}}},'b')).rejects.toBeInstanceOf(SnapshotRevisionConflict);
  const current:any=await assembleState('p','2026-11-26');
  expect(current._remote.revision).toBe(2);
  expect(current.floors[0].stages).toEqual(['winner']);
  expect(current.days['2026-11-25'].note).toBe('vencedor');
  expect(current.days['2026-11-26']).toBeUndefined();
});

it('rolls back the metadata when a floor or day write fails inside the batch',async()=>{
  await saveSnapshot('p',{project:{name:'Obra'},floors:[],days:{}},'admin');
  const base:any=await assembleState('p');
  store.DB.db.exec("CREATE TRIGGER block_day BEFORE INSERT ON kv_records WHEN NEW.collection LIKE 'project_day_%' BEGIN SELECT RAISE(ABORT,'disk full'); END");
  await expect(saveSnapshot('p',{...base,project:{name:'Alterada'},days:{'2026-11-25':{note:'x'}}},'a')).rejects.toThrow('disk full');
  const current:any=await assembleState('p');
  expect(current._remote.revision).toBe(1);
  expect(current.project.name).toBe('Obra');
});
