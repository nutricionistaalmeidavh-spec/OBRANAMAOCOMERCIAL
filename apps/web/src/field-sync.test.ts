// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { createFieldSync, syncScope } from './field-sync';
import { focusManagementSection, renderManagementDashboard } from './mobile-dashboard';
beforeEach(()=>localStorage.clear());
const key='test-draft';
function setup(extra:Record<string,any>={}) {return createFieldSync({key,storage:localStorage,baseline:{n:0},readRemote:async()=>({n:0}),send:async()=>{},status:()=>{},...extra});}
it('persists a failed send across restart and clears only after successful retry',async()=>{
 const status=vi.fn(),send=vi.fn().mockRejectedValue(new Error('offline'));
 const first=setup({send,status});first.save({n:1});await first.flush();
 expect(first.read()?.state).toEqual({n:1});expect(status).toHaveBeenLastCalledWith('pending');
 const retry=vi.fn();const restarted=setup({send:retry});await restarted.flush();
 expect(retry).toHaveBeenCalledWith({n:1});expect(restarted.read()).toBeNull();
});
it('does not overwrite divergent remote state and preserves conflict draft',async()=>{
 const status=vi.fn(),send=vi.fn();const sync=setup({send,status,readRemote:async()=>({n:2})});
 sync.save({n:1});await sync.flush();expect(send).not.toHaveBeenCalled();expect(status).toHaveBeenLastCalledWith('conflict');expect(sync.read()?.state).toEqual({n:1});
});
it('isolates user, company and project drafts and refuses incomplete identities',()=>{
 const b={user:{userId:'u'},membership:{companyId:'c',projectId:'p'}};
 const a=syncScope(b)!;expect(syncScope({})).toBeNull();
 for(const other of [{...b,user:{userId:'v'}},{...b,membership:{companyId:'d',projectId:'p'}},{...b,membership:{companyId:'c',projectId:'q'}}])expect(syncScope(other)).not.toBe(a);
 setup({key:a}).save({n:1});expect(setup({key:syncScope({...b,user:{userId:'v'}})!}).read()).toBeNull();
});
it('never sends an old draft after logout while preflight is in flight',async()=>{
 let release!:(value:unknown)=>void;const send=vi.fn();const sync=setup({send,readRemote:()=>new Promise(resolve=>release=resolve)});
 sync.save({n:1});const flight=sync.flush();sync.dispose();release({n:0});await flight;
 expect(send).not.toHaveBeenCalled();expect(sync.read()).not.toBeNull();
});
it('keeps newer edits made during an in-flight send',async()=>{
 let release!:()=>void;let remote={n:0};const send=vi.fn(async(state:any)=>{if(state.n===1)await new Promise<void>(resolve=>release=resolve);remote=state;});
 const sync=setup({send,readRemote:async()=>remote});sync.save({n:1});const flight=sync.flush();await Promise.resolve();sync.save({n:2});release();await flight;
 expect(remote).toEqual({n:2});expect(sync.read()).toBeNull();
});
it('renders and focuses only permitted management deep-link targets',()=>{
 const root=document.createElement('main');document.body.replaceChildren(root);
 renderManagementDashboard(root,{modules:{documents:{total:4,expiring30d:2},measurements:{open:3}}},{modules:['documents']});
 focusManagementSection(root,'#gestao/documents');expect(document.activeElement?.id).toBe('management-documents');
 expect(root.querySelector('#management-measurements')).toBeNull();focusManagementSection(root,'#gestao/measurements');expect(document.activeElement?.id).toBe('management-documents');
});
