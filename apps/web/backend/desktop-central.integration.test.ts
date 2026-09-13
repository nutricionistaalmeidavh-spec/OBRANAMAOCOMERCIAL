import {createRequire} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
import worker from '../cloudflare/worker';
const require=createRequire(import.meta.url);
const {DatabaseSync}=require('node:sqlite');
const {OnlineService}=require('../../desktop/electron/services/online-service.cjs');
class TestDB{
 db=new DatabaseSync(':memory:');
 constructor(){const dir=new URL('../cloudflare/migrations/',import.meta.url);for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())this.db.exec(readFileSync(new URL(name,dir),'utf8'));}
 prepare(sql:string){const db=this.db;const stmt=(args:any[]=[])=>({bind:(...values:any[])=>stmt(values.map(v=>v===undefined?null:v)),first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),execute:()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});return stmt()}
 async batch(statements:any[]){this.db.exec('BEGIN');try{const results=statements.map(s=>s.execute());this.db.exec('COMMIT');return results}catch(e){this.db.exec('ROLLBACK');throw e}}
}
describe('Central Artisys to real desktop password service',()=>{
 it('activates directly in desktop, scopes tenants, exposes activation and enforces suspension',async()=>{
 const DB=new TestDB(),env={DB:DB as any,OWNER_EMAIL:'owner@example.com',OWNER_COMPANY:'Artisys'};
 DB.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?,?)').run('owner-session','owner','owner@example.com','Owner','2099-01-01','2026-01-01');
 const call=(path:string,body?:unknown,cookie='owner-session',method=body?'POST':'GET')=>worker.fetch(new Request('https://test.example'+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie:`obn_session=${cookie}`}:{})},body:body?JSON.stringify(body):undefined}),env);
 const create=await call('/api/owner/companies',{name:'Cliente A',adminEmail:'a@example.com',modules:['obra360','finance'],channels:['desktop']});expect(create.status).toBe(201);const a=await create.json() as any;
 const other=await call('/api/owner/companies',{name:'Cliente B',adminEmail:'b@example.com',modules:['obra360'],channels:['desktop']});expect(other.status).toBe(201);const b=await other.json() as any;
 expect((await call('/api/owner/companies',undefined,'')).status).toBe(401);
 const dir=mkdtempSync(join(tmpdir(),'desktop-central-'));
 try{
 const online=new OnlineService({dataDir:dir,shell:{openExternal:()=>{throw Error('Browser must not open')}},baseUrl:'https://test.example',fetchImpl:(url:string,init:any)=>worker.fetch(new Request(url,init),env)});
 const first=await online.passwordAuth({email:'a@example.com',password:'A-valid-password-2026',code:a.license.code,firstAccess:true});expect(first.needsSetup).toBe(true);
 const linked=await online.completePasswordLink({companyName:'Cliente A',projectName:'Obra A'});expect(linked.linked).toBe(true);expect(linked.company.id).toBe(a.company.id);expect(linked.company.id).not.toBe(b.company.id);
 const session=await online.request('/api/desktop/session',{deviceToken:online.deviceToken()});expect(session.company.id).toBe(a.company.id);
 const inventory=await (await call('/api/owner/companies')).json() as any;const view=inventory.companies.find((c:any)=>c.id===a.company.id);expect(view.passwordCreatedAt).toBeTruthy();expect(view.devicesCount).toBe(1);expect(view.projectsCount).toBe(1);expect(inventory.companies.find((c:any)=>c.id===b.company.id).devicesCount).toBe(0);
 const pwdLogin=await call('/api/auth/password/login',{email:'a@example.com',password:'A-valid-password-2026'},'');const cookie=pwdLogin.headers.get('set-cookie')!.match(/obn_session=([^;]+)/)![1];expect((await call('/api/owner/companies',undefined,cookie)).status).toBe(403);
 online.disconnect();expect((await online.passwordAuth({email:'a@example.com',password:'A-valid-password-2026'})).linked).toBe(true);
 expect((await call(`/api/owner/companies/${a.company.id}`,{status:'suspended'},'owner-session','PUT')).status).toBe(200);
 expect((await call('/api/desktop/session',{deviceToken:online.deviceToken()},'')).status).toBe(403);
 }finally{rmSync(dir,{recursive:true,force:true});DB.db.close()}
 },20000);
});

