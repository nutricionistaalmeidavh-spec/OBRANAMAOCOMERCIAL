import { beforeEach, expect, it, vi } from 'vitest';

const memory=vi.hoisted(()=>{
  let sequence=0;
  const collections=new Map<string,Map<string,Record<string,unknown>>>();
  const bucket=(name:string)=>{let value=collections.get(name);if(!value){value=new Map();collections.set(name,value)}return value};
  // Yield between storage calls so concurrent writers really interleave.
  const tick=()=>new Promise(resolve=>setTimeout(resolve,Math.random()*3));
  const db={
    async list<T=Record<string,unknown>>(collection:string,options:{limit?:number}={}){await tick();const limit=Math.max(1,Number(options.limit||100));return{items:[...bucket(collection).entries()].slice(-limit).reverse().map(([id,r])=>({...structuredClone(r),id})) as Array<T&{id:string}>}},
    async get<T=Record<string,unknown>>(collection:string,ids:string[]){await tick();return ids.flatMap(id=>{const r=bucket(collection).get(String(id));return r?[{...structuredClone(r),id}]:[]}) as Array<T&{id:string}>},
    async add(collection:string,records:Array<Record<string,unknown>>){await tick();const ids:string[]=[];for(const r of records){const id='id_'+(++sequence),clean=structuredClone(r);delete clean.id;bucket(collection).set(id,clean);ids.push(id)}return ids},
    async update(collection:string,changes:Array<{id:string;record:Record<string,unknown>}>){await tick();for(const c of changes){const clean=structuredClone(c.record);delete clean.id;bucket(collection).set(String(c.id),clean)}return changes.map(c=>c.id)},
    async delete(collection:string,ids:string[]){await tick();for(const id of ids)bucket(collection).delete(String(id));return true}
  };
  const runtimeEnv=()=>({DB:{prepare:(sql:string)=>{let args:any[]=[];return{bind(...values:any[]){args=values;return this},async run(){
    await tick();
    if(sql.startsWith('UPDATE kv_records SET record_json=')){const [raw,,collection,id,expected]=args,current=bucket(collection).get(String(id));if(!current||Number(current.revision)!==Number(expected))return{meta:{changes:0}};bucket(collection).set(String(id),JSON.parse(raw));return{meta:{changes:1}}}
    if(sql.startsWith('INSERT INTO kv_records')&&sql.includes('DO NOTHING')){const [collection,id,raw]=args,target=bucket(collection);if(target.has(String(id)))return{meta:{changes:0}};target.set(String(id),JSON.parse(raw));return{meta:{changes:1}}}
    return{meta:{changes:0}}}}}}});
  return{db,runtimeEnv,bucket,reset(){sequence=0;collections.clear()}};
});
vi.mock('../cloudflare/sdk',()=>({db:memory.db,runtimeEnv:memory.runtimeEnv}));

import { appendDesktopSyncChange, deviceByToken, indexDeviceToken, LEGACY_DEVICE_TOKEN_CUTOFF } from './desktop-store';
import { applyDesktopBridgeChange } from './e06e09';
import { carryForwardActiveAssignments, getMeta } from './project-state';

const fnv=(v:string)=>{let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
function collidingTokens(){
  // Birthday search: two distinct 64-char tokens with the same 32-bit legacy index.
  const seen=new Map<string,string>();
  for(let i=0;;i++){const token=(i.toString(16)+'x').padEnd(64,'0');const key=fnv(token);const other=seen.get(key);if(other)return[other,token];seen.set(key,token)}
}
const device=(extra:Record<string,unknown>={})=>({installationId:'i',name:'PC',userId:'u',email:'a@example.com',status:'active',createdAt:'',updatedAt:'',lastSeenAt:'',...extra});

beforeEach(()=>memory.reset());

it('authenticates a v2 device token only by its full SHA-256 digest',async()=>{
  memory.bucket('devices').set('device-a',device());
  const token='t'.repeat(64);
  await indexDeviceToken('device-a',token);
  expect((await deviceByToken(token))?.id).toBe('device-a');
  expect(await deviceByToken('u'.repeat(64))).toBeNull();
});

it('rejects a string that collides with a legacy token index once the device was migrated',async()=>{
  const [real,forged]=collidingTokens();
  expect(real).not.toBe(forged);
  memory.bucket('devices').set('device-a',device());
  memory.bucket('device_token_'+fnv(real)).set('ref',{deviceId:'device-a'});
  // The real device connects first after deploy and binds its digest.
  expect((await deviceByToken(real,{nowIso:'2026-12-01T00:00:00.000Z'}))?.id).toBe('device-a');
  expect(memory.bucket('device_token_'+fnv(real)).size).toBe(0);
  expect(await deviceByToken(forged,{nowIso:'2026-12-01T00:00:00.000Z'})).toBeNull();
  expect((await deviceByToken(real))?.id).toBe('device-a');
});

it('stops accepting unmigrated legacy tokens after the cutoff',async()=>{
  const token='l'.repeat(64);
  memory.bucket('devices').set('device-a',device());
  memory.bucket('device_token_'+fnv(token)).set('ref',{deviceId:'device-a'});
  expect(await deviceByToken(token,{nowIso:LEGACY_DEVICE_TOKEN_CUTOFF})).toBeNull();
});

it('allocates distinct desktop sync revisions under concurrent pushes',async()=>{
  const results=await Promise.all(Array.from({length:12},(_,i)=>appendDesktopSyncChange('project-a','device-a',{changeId:'change-'+String(i).padStart(8,'0'),entity:'tarefas_obra',localId:i+1,payload:{}})));
  const revisions=results.map(r=>r.revision).sort((a,b)=>a-b);
  expect(revisions).toEqual(Array.from({length:12},(_,i)=>i+1));
  // A retried change id never claims a second revision.
  const again=await appendDesktopSyncChange('project-a','device-a',{changeId:'change-00000003',entity:'tarefas_obra',localId:4,payload:{}});
  expect(again.duplicate).toBe(true);
});

it('keeps every concurrent Desktop bridge change instead of overwriting the metadata',async()=>{
  await memory.db.add('project_meta_project-a',[{state:{desktopBridge:{}},dayKeys:[],revision:0,updatedAt:'',updatedBy:''}]);
  await Promise.all(Array.from({length:8},(_,i)=>applyDesktopBridgeChange('project-a','device-a',{changeId:'c'+i,entity:'tarefas_obra',localId:i+1,baseMobileRevision:0,payload:{titulo:'Tarefa '+i}},i+1)));
  const meta=await getMeta('project-a') as any;
  expect(meta.state.desktopBridge.tasks.map((t:any)=>t.localId).sort((a:number,b:number)=>a-b)).toEqual([1,2,3,4,5,6,7,8]);
  expect(meta.revision).toBe(8);
});

it('does not roll back a concurrent metadata change while carrying assignments forward',async()=>{
  await memory.db.add('project_meta_project-a',[{state:{desktopBridge:{},settings:{defaultWorkStart:'07:00'}},dayKeys:['2026-11-24'],revision:3,updatedAt:'',updatedBy:''}]);
  memory.bucket('project_day_project-a_2026-11-24').set('d',{day:{date:'2026-11-24',assignments:[{service:'corte',floor:0,status:'in_progress'}]}});
  await Promise.all([
    carryForwardActiveAssignments('project-a','2026-11-25','system'),
    applyDesktopBridgeChange('project-a','device-a',{changeId:'x1',entity:'tarefas_obra',localId:7,baseMobileRevision:0,payload:{titulo:'Nova'}},1),
  ]);
  const meta=await getMeta('project-a') as any;
  expect(meta.dayKeys).toContain('2026-11-25');
  expect(meta.state.desktopBridge.tasks.map((t:any)=>t.localId)).toEqual([7]);
});
