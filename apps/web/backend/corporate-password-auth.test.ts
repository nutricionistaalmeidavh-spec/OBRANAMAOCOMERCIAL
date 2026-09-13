import {createRequire} from 'node:module';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {handleCorporatePasswordAuth} from './corporate-password-auth';
class TestDB{
 db=new DatabaseSync(':memory:');beforeBatch:(()=>void)|undefined;
 constructor(){this.db.exec(`CREATE TABLE kv_records(collection TEXT,id TEXT,record_json TEXT,created_at TEXT,updated_at TEXT,PRIMARY KEY(collection,id));CREATE TABLE auth_sessions(id TEXT,user_id TEXT,email TEXT,name TEXT,expires_at TEXT,created_at TEXT);`)}
 prepare(sql:string){const db=this.db;const stmt=(args:any[]=[])=>({bind:(...values:any[])=>stmt(values),first:async()=>db.prepare(sql).get(...args),all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),execute:()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});return stmt()}
 async batch(statements:any[]){this.beforeBatch?.();this.beforeBatch=undefined;this.db.exec('BEGIN');try{const result=statements.map(s=>s.execute());this.db.exec('COMMIT');return result}catch(e){this.db.exec('ROLLBACK');throw e}}
}
const email='client@example.com';
function seed(db:TestDB){let h=2166136261;for(const c of email){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}const collection=`license_email_${email.replace(/[^a-zA-Z0-9_-]/g,'_')}_${(h>>>0).toString(16)}`;const stmt=db.db.prepare('INSERT INTO kv_records VALUES(?,?,?,?,?)');stmt.run('licenses','lic',JSON.stringify({email,code:'CODE',status:'active',companyId:'isolated'}),'2026','2026');stmt.run(collection,'ref',JSON.stringify({licenseId:'lic'}),'2026','2026')}
async function call(db:TestDB,path:string,password:string){return(await handleCorporatePasswordAuth(new Request(`https://example.com/api/auth/password/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,code:'CODE',password})}),{DB:db as any}))!}
describe('atomic corporate activation',()=>{
 beforeEach(()=>{
  const deriveBits=crypto.subtle.deriveBits.bind(crypto.subtle);
  vi.spyOn(crypto.subtle,'deriveBits').mockImplementation((...args:Parameters<SubtleCrypto['deriveBits']>)=>{
   const algorithm=args[0] as Pbkdf2Params;
   if(algorithm.name==='PBKDF2'&&algorithm.iterations>100_000)throw new DOMException('PBKDF2 iteration counts above 100000 are not supported','NotSupportedError');
   return deriveBits(...args);
  });
 });
 afterEach(()=>vi.restoreAllMocks());
 it('has one concurrent winner and cannot overwrite its password or tenant',async()=>{const db=new TestDB();seed(db);const passwords=['first-password','second-password'];const results=await Promise.all(passwords.map(p=>call(db,'first-access',p)));expect(results.map(r=>r.status).sort()).toEqual([200,409]);const winner=results.findIndex(r=>r.status===200);expect((await call(db,'login',passwords[winner])).status).toBe(200);expect((await call(db,'login',passwords[1-winner])).status).toBe(401);const lic=JSON.parse((db.db.prepare("SELECT record_json FROM kv_records WHERE collection='licenses'").get() as any).record_json);expect(lic.companyId).toBe('isolated');expect(lic.claimedBy).toMatch(/^pwd:/);expect((await call(db,'first-access','third-password')).status).toBe(409)});
 it('rejects revocation during hashing without leaving credentials or sessions',async()=>{const db=new TestDB();seed(db);db.beforeBatch=()=>db.db.exec(`UPDATE kv_records SET record_json=json_set(record_json,'$.status','revoked') WHERE collection='licenses'`);expect((await call(db,'first-access','first-password')).status).toBe(409);expect((db.db.prepare('SELECT count(*) AS n FROM password_credentials').get() as any).n).toBe(0);expect((db.db.prepare('SELECT count(*) AS n FROM auth_sessions').get() as any).n).toBe(0)});
 it('rejects already revoked licenses',async()=>{const db=new TestDB();seed(db);db.db.exec(`UPDATE kv_records SET record_json=json_set(record_json,'$.status','revoked') WHERE collection='licenses'`);expect((await call(db,'first-access','first-password')).status).toBe(401)});
});
