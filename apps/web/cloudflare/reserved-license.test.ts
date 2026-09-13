import {createRequire} from 'node:module';
import {describe,expect,it,vi} from 'vitest';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
vi.mock('../backend/index',()=>({handler:{fetch:vi.fn()}}));
vi.mock('../backend/asaas-webhook',()=>({handleAsaasWebhook:vi.fn()}));
vi.mock('../backend/billing-schema-runtime',()=>({ensureBillingSchema:vi.fn()}));
vi.mock('../backend/corporate-password-auth',()=>({handleCorporatePasswordAuth:vi.fn()}));
import {provisionReservedLifetimeLicense} from './worker';
function database(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE kv_records(collection TEXT,id TEXT,record_json TEXT,created_at TEXT,updated_at TEXT,PRIMARY KEY(collection,id))');return{db,env:{DB:{prepare:(sql:string)=>({bind:(...args:any[])=>({first:async()=>db.prepare(sql).get(...args),run:async()=>db.prepare(sql).run(...args)})})}}}}
const id='11e1a89038929aa010bb22c601502da1';
describe('reserved commercial license bootstrap',()=>{
 it('preserves revocation, tenant binding, claim and edited limits byte for byte',async()=>{const{db,env}=database();const record=JSON.stringify({email:'everton.eng@hotmail.com',status:'revoked',companyId:'isolated-everton',claimedBy:'user-everton',maxUsers:3,plan:'custom',expiresAt:'2027-01-01'});db.prepare('INSERT INTO kv_records VALUES(?,?,?,?,?)').run('licenses',id,record,'old','old');await provisionReservedLifetimeLicense(env);expect(db.prepare("SELECT record_json,updated_at FROM kv_records WHERE collection='licenses' AND id=?").get(id)).toEqual({record_json:record,updated_at:'old'})});
 it('creates only the missing reservation and retains subsequent tenant assignment',async()=>{const{db,env}=database();await provisionReservedLifetimeLicense(env);const row=db.prepare("SELECT record_json FROM kv_records WHERE collection='licenses' AND id=?").get(id);expect(JSON.parse(row.record_json).email).toBe('everton.eng@hotmail.com');db.exec(`UPDATE kv_records SET record_json=json_set(record_json,'$.companyId','isolated-everton','$.claimedBy','user-everton') WHERE collection='licenses'`);await provisionReservedLifetimeLicense(env);const after=JSON.parse(db.prepare("SELECT record_json FROM kv_records WHERE collection='licenses' AND id=?").get(id).record_json);expect(after.companyId).toBe('isolated-everton');expect(after.claimedBy).toBe('user-everton')});
});
