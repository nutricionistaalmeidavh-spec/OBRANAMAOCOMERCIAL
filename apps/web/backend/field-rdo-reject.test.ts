import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

const store=vi.hoisted(()=>({DB:null as any}));
vi.mock('../cloudflare/sdk',()=>({
  runtimeEnv:()=>({DB:store.DB}),
  db:{async list(collection:string,options:{limit?:number}={}){const rows=await store.DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT ?').bind(collection,options.limit||100).all();return{items:rows.results.map((r:any)=>({...JSON.parse(r.record_json),id:r.id}))}}},
}));
import { confirmFieldRdo, pendingFieldRdos, rejectFieldRdo, FIELD_RDO_RETRY_MS } from './field-rdo-delivery';

const require=createRequire(import.meta.url);
const {DatabaseSync}=require('node:sqlite');
class TestDB{
  db=new DatabaseSync(':memory:');
  constructor(){const dir=new URL('../cloudflare/migrations/',import.meta.url);for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())this.db.exec(readFileSync(new URL(name,dir),'utf8'))}
  prepare(sql:string){const db=this.db;const stmt=(args:any[]=[])=>({bind:(...values:any[])=>stmt(values.map(v=>v===undefined?null:v)),first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});return stmt()}
}
const day={date:'2026-11-20',rdoStatus:'ready_for_desktop',materialsReviewed:true,rdoClosedFingerprint:'fp-1',sessions:[],materials:[],photos:[]};
beforeEach(()=>{
  store.DB=new TestDB();
  store.DB.db.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)').run('project_day_project-a_2026-11-20','d',JSON.stringify({day}),'2026-11-20','2026-11-20');
});

it('keeps a rejected RDO out of the queue during the retry pause, with the reason visible to the phone',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-25T12:00:00Z'));
  try{
    expect((await pendingFieldRdos('project-a')).map(r=>r.date)).toEqual(['2026-11-20']);
    const receipt=await rejectFieldRdo('project-a',{date:'2026-11-20',fingerprint:'fp-1',reason:'Saldo insuficiente para Tubo PVC (m). Disponível: 2.'},'device-a');
    expect(receipt).toMatchObject({status:'rejected',reason:expect.stringContaining('Saldo insuficiente')});
    expect(await pendingFieldRdos('project-a')).toEqual([]);
    vi.setSystemTime(new Date(Date.parse('2026-11-25T12:00:00Z')+FIELD_RDO_RETRY_MS+1000));
    expect((await pendingFieldRdos('project-a')).map(r=>r.date)).toEqual(['2026-11-20']);
    // A later successful integration replaces the rejection and leaves the queue.
    await confirmFieldRdo('project-a',{date:'2026-11-20',fingerprint:'fp-1',localRdoId:5,materialRevision:1},'device-a');
    expect(await pendingFieldRdos('project-a')).toEqual([]);
  }finally{vi.useRealTimers()}
});

it('never downgrades an applied receipt and ignores a rejection for an outdated revision of the day',async()=>{
  await confirmFieldRdo('project-a',{date:'2026-11-20',fingerprint:'fp-1',localRdoId:5,materialRevision:1},'device-a');
  expect(await rejectFieldRdo('project-a',{date:'2026-11-20',fingerprint:'fp-1',reason:'x'},'device-a')).toMatchObject({status:'applied'});
  expect(await rejectFieldRdo('project-a',{date:'2026-11-20',fingerprint:'fp-old',reason:'x'},'device-a')).toMatchObject({status:'stale'});
});

it('skips the retry pause for a day the office just resolved and records pending consumption on the receipt',async()=>{
  await rejectFieldRdo('project-a',{date:'2026-11-20',fingerprint:'fp-1',reason:'RDO digitado no escritório em 20/11/2026'},'device-a');
  expect(await pendingFieldRdos('project-a')).toEqual([]);
  expect((await pendingFieldRdos('project-a',{retryDates:['2026-11-20']})).map(r=>r.date)).toEqual(['2026-11-20']);
  const receipt=await confirmFieldRdo('project-a',{date:'2026-11-20',fingerprint:'fp-1',localRdoId:5,materialRevision:0,materialPending:'Saldo insuficiente para Tubo (m). Disponível: 1.'},'device-a');
  expect(receipt).toMatchObject({status:'applied',materialPending:expect.stringContaining('Saldo insuficiente')});
  expect(await pendingFieldRdos('project-a',{retryDates:['2026-11-20']})).toEqual([]);
});

it('redelivers a receipt awaiting material so the phone can learn that stock was applied',async()=>{
  vi.useFakeTimers();
  try{
    vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
    const input={date:'2026-11-20',fingerprint:'fp-1',localRdoId:5,materialRevision:0};
    await confirmFieldRdo('project-a',{...input,materialPending:'Saldo insuficiente'},'device-a');
    expect(await pendingFieldRdos('project-a')).toEqual([]);
    vi.setSystemTime(new Date('2026-11-20T10:15:00Z'));
    expect((await pendingFieldRdos('project-a')).map(report=>report.date)).toEqual([input.date]);
    await confirmFieldRdo('project-a',{...input,materialRevision:1},'device-a');
    expect(await pendingFieldRdos('project-a')).toEqual([]);
  }finally{vi.useRealTimers()}
});
