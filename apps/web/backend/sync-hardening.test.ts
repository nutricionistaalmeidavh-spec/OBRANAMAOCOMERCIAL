import { beforeEach, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => {
  let sequence = 0;
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  const bucket = (name:string) => { let value=collections.get(name); if(!value){value=new Map();collections.set(name,value)} return value };
  const db = {
    async list<T=Record<string,unknown>>(collection:string,options:{limit?:number}={}){const items=[...bucket(collection).entries()].slice(-(options.limit||100)).reverse().map(([id,r])=>({...structuredClone(r),id})) as Array<T&{id:string}>;return{items}},
    async get<T=Record<string,unknown>>(collection:string,ids:string[]){return ids.flatMap(id=>{const r=bucket(collection).get(String(id));return r?[{...structuredClone(r),id}]:[]}) as Array<T&{id:string}>},
    async add(collection:string,records:Array<Record<string,unknown>>){const ids:string[]=[];for(const r of records){const id='id_'+(++sequence),clean=structuredClone(r);delete clean.id;bucket(collection).set(id,clean);ids.push(id)}return ids},
    async update(collection:string,changes:Array<{id:string;record:Record<string,unknown>}>){for(const c of changes){const clean=structuredClone(c.record);delete clean.id;bucket(collection).set(String(c.id),clean)}return changes.map(c=>c.id)},
    async delete(collection:string,ids:string[]){for(const id of ids)bucket(collection).delete(String(id));return true}
  };
  const runtimeEnv=()=>({DB:{prepare:(sql:string)=>{let args:any[]=[];return{bind(...values:any[]){args=values;return this},async run(){if(sql.startsWith('UPDATE kv_records SET record_json=')){const [raw,,collection,id,expected]=args,current=bucket(collection).get(String(id));if(!current||Number(current.revision)!==Number(expected))return{meta:{changes:0}};bucket(collection).set(String(id),JSON.parse(raw));return{meta:{changes:1}}}return{meta:{changes:0}}}}}}});
  return{db,runtimeEnv,bucket,reset(){sequence=0;collections.clear()}};
});

vi.mock('../cloudflare/sdk',()=>({db:memory.db,runtimeEnv:memory.runtimeEnv}));
import { applyDesktopBridgeChange } from './e06e09';
import { assembleState, saveSnapshot, SnapshotRevisionConflict } from './project-state';

beforeEach(()=>memory.reset());

it('keeps B after A -> B -> retry A and does not advance revision on stale retry',async()=>{
  await memory.db.add('project_meta_project-a',[{state:{desktopBridge:{}},dayKeys:[],revision:0,updatedAt:'',updatedBy:''}]);
  const a={changeId:'A',entity:'tarefas_obra',localId:10,baseMobileRevision:0,payload:{status:'em_andamento'}};
  const b={changeId:'B',entity:'tarefas_obra',localId:10,baseMobileRevision:0,payload:{status:'concluido'}};
  await applyDesktopBridgeChange('project-a','device-a',a,1);
  await applyDesktopBridgeChange('project-a','device-a',b,2);
  const retry=await applyDesktopBridgeChange('project-a','device-a',a,1);
  expect(retry.bridged).toBe(true);
  const meta=(await memory.db.list<any>('project_meta_project-a',{limit:1})).items[0];
  expect(meta.revision).toBe(2);
  expect(meta.state.desktopBridge.tasks[0].payload.status).toBe('concluido');
  expect(meta.state.desktopBridge.tasks[0].appliedChangeIds).toEqual(['A','B']);
});

it('atomically rejects a stale whole-project snapshot revision',async()=>{
  await saveSnapshot('project-a',{project:{name:'Obra'},employees:[],floors:[],days:{}},'admin-a');
  const base=await assembleState('project-a');
  expect((base as any)._remote.revision).toBe(1);
  await saveSnapshot('project-a',{...(base as any),project:{name:'Primeira edição'}},'admin-a');
  await expect(saveSnapshot('project-a',{...(base as any),project:{name:'Edição obsoleta'}},'admin-b')).rejects.toBeInstanceOf(SnapshotRevisionConflict);
  const current=await assembleState('project-a');
  expect((current as any).project.name).toBe('Primeira edição');
  expect((current as any)._remote.revision).toBe(2);
});