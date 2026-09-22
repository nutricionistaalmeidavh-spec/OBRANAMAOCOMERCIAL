import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminGovernanceRequest } from './admin-governance-http';

type Stored={record:Record<string,unknown>;updatedAt:string};
class FakeD1{
  collections=new Map<string,Map<string,Stored>>();
  put(collection:string,id:string,record:Record<string,unknown>,updatedAt='2026-09-22T02:00:00.000Z'){let bucket=this.collections.get(collection);if(!bucket){bucket=new Map();this.collections.set(collection,bucket)}bucket.set(id,{record:structuredClone(record),updatedAt})}
  get(collection:string,id:string){return this.collections.get(collection)?.get(id)?.record}
  prepare(sql:string){const db=this;let args:unknown[]=[];return{
    bind(...values:unknown[]){args=values;return this},
    async all<T>(){const collection=String(args[0]||''),limit=Number(args[1]||1000),bucket=db.collections.get(collection)||new Map();const results=[...bucket.entries()].reverse().slice(0,limit).map(([id,item])=>({id,record_json:JSON.stringify(item.record),updated_at:item.updatedAt})) as T[];return{results}},
    async first<T>(){const collection=String(args[0]||''),id=String(args[1]||''),item=db.collections.get(collection)?.get(id);return(item?{id,record_json:JSON.stringify(item.record),updated_at:item.updatedAt}:null) as T|null},
    async run(){if(sql.startsWith('UPDATE kv_records SET record_json=')){const record=JSON.parse(String(args[0])) as Record<string,unknown>,updatedAt=String(args[1]),id=String(args[2]);db.put('devices',id,record,updatedAt);return{success:true,meta:{changes:1}}}throw new Error('Unexpected SQL in fake D1: '+sql)}
  }}
}

const adminBootstrap=(overrides:Record<string,unknown>={})=>new Response(JSON.stringify({role:'admin',membership:{companyId:'company-a',projectId:'project-a'},company:{id:'company-a'},project:{id:'project-a'},access:{licenseId:'license-a',modules:['obra360'],channels:['desktop','mobile'],status:'active'},...overrides}),{status:200,headers:{'content-type':'application/json'}});
const request=(path:string,init:RequestInit={})=>new Request('https://obra.test'+path,{method:init.method||'GET',headers:{'content-type':'application/json'},body:init.body});

describe('tenant admin governance HTTP',()=>{
  let db:FakeD1;
  beforeEach(()=>{
    db=new FakeD1();
    db.put('devices','device-a',{companyId:'company-a',projectId:'project-a',name:'Notebook A',platform:'win32',email:'admin@a.test',status:'active',lastSeenAt:'2026-09-22T02:30:00.000Z',updatedAt:'2026-09-22T02:30:00.000Z'});
    db.put('devices','device-b',{companyId:'company-b',projectId:'project-b',name:'Notebook B',platform:'win32',email:'admin@b.test',status:'active',lastSeenAt:'2026-09-22T02:35:00.000Z'});
    db.put('licenses','license-a',{status:'active',maxDevices:2});
    db.put('project_meta_project-a','meta-a',{revision:18,updatedAt:'2026-09-22T02:45:00.000Z'});
    db.put('desktop_sync_head_project-a','head-a',{revision:17,updatedAt:'2026-09-22T02:40:00.000Z'});
    db.put('sync_conflicts_project-a','conflict-open',{status:'open',createdAt:'2026-09-22T02:42:00.000Z'});
    db.put('sync_conflicts_project-a','conflict-done',{status:'resolved',createdAt:'2026-09-22T02:20:00.000Z'});
  });

  it('lists only computers from the authenticated admin company',async()=>{
    const response=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices'),{DB:db as unknown as D1Database},async()=>adminBootstrap());
    expect(response?.status).toBe(200);const data=await response!.json() as {devices:Array<{id:string;name:string}>};
    expect(data.devices).toEqual([expect.objectContaining({id:'device-a',name:'Notebook A'})]);
  });

  it('refuses cross-tenant device mutation and preserves the foreign device',async()=>{
    const response=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices/device-b',{method:'PUT',body:JSON.stringify({status:'revoked'})}),{DB:db as unknown as D1Database},async()=>adminBootstrap());
    expect(response?.status).toBe(404);expect(db.get('devices','device-b')?.status).toBe('active');
  });

  it('revokes and reactivates a tenant computer without mutating the license',async()=>{
    const licenseBefore=structuredClone(db.get('licenses','license-a'));
    const revoke=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices/device-a',{method:'PUT',body:JSON.stringify({status:'revoked'})}),{DB:db as unknown as D1Database},async()=>adminBootstrap());
    expect(revoke?.status).toBe(200);expect(db.get('devices','device-a')?.status).toBe('revoked');
    const activate=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices/device-a',{method:'PUT',body:JSON.stringify({status:'active'})}),{DB:db as unknown as D1Database},async()=>adminBootstrap());
    expect(activate?.status).toBe(200);expect(db.get('devices','device-a')?.status).toBe('active');expect(db.get('licenses','license-a')).toEqual(licenseBefore);
  });

  it('blocks reactivation when the company already reached maxDevices',async()=>{
    db.put('licenses','license-a',{status:'active',maxDevices:1});
    db.put('devices','device-disabled',{companyId:'company-a',projectId:'project-a',name:'Notebook reserva',status:'revoked'});
    const response=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices/device-disabled',{method:'PUT',body:JSON.stringify({status:'active'})}),{DB:db as unknown as D1Database},async()=>adminBootstrap());
    expect(response?.status).toBe(409);expect(db.get('devices','device-disabled')?.status).toBe('revoked');
  });

  it('reports independent Web/Desktop revisions, open conflicts and tenant device activity',async()=>{
    const response=await handleAdminGovernanceRequest(request('/api/mobile/admin/sync-status'),{DB:db as unknown as D1Database},async()=>adminBootstrap());
    expect(response?.status).toBe(200);const data=await response!.json() as Record<string,unknown>;
    expect(data).toMatchObject({serverRevision:18,desktopRevision:17,conflictCount:1,activeDevices:1,revokedDevices:0,lastServerUpdateAt:'2026-09-22T02:45:00.000Z',lastDesktopPushAt:'2026-09-22T02:40:00.000Z',lastDesktopSeenAt:'2026-09-22T02:30:00.000Z'});
    expect((data.devices as Array<{id:string}>).map(item=>item.id)).toEqual(['device-a']);
  });

  it('requires the canonical bootstrap role to be admin',async()=>{
    const response=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices'),{DB:db as unknown as D1Database},async()=>adminBootstrap({role:'foreman'}));
    expect(response?.status).toBe(403);
  });

  it('requires Obra360 on the mobile channel for governance surfaces',async()=>{
    const noMobile=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices'),{DB:db as unknown as D1Database},async()=>adminBootstrap({access:{licenseId:'license-a',modules:['obra360'],channels:['desktop'],status:'active'}}));
    expect(noMobile?.status).toBe(403);
    const noObra360=await handleAdminGovernanceRequest(request('/api/mobile/admin/devices'),{DB:db as unknown as D1Database},async()=>adminBootstrap({access:{licenseId:'license-a',modules:['rdo'],channels:['desktop','mobile'],status:'active'}}));
    expect(noObra360?.status).toBe(403);
  });
});
