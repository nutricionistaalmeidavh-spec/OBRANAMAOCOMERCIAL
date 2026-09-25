import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { fetchDeboraObservability } from '../backend/debora-observability-admin';
import { grantManualDeboraLicenseWithSale } from '../backend/manual-license-sales';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

function licenseDb(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE product_accounts(product_code TEXT NOT NULL,email TEXT NOT NULL,status TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(product_code,email));
    CREATE TABLE product_licenses(id TEXT PRIMARY KEY,product_code TEXT NOT NULL,email TEXT NOT NULL,plan_code TEXT NOT NULL,status TEXT NOT NULL,starts_at TEXT NOT NULL,expires_at TEXT,source TEXT NOT NULL,external_ref TEXT NOT NULL DEFAULT '',metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE product_license_events(id TEXT PRIMARY KEY,license_id TEXT,product_code TEXT NOT NULL,email TEXT NOT NULL,action TEXT NOT NULL,actor TEXT,source TEXT,details_json TEXT,created_at TEXT NOT NULL);
    CREATE TABLE manual_license_sales(id TEXT PRIMARY KEY,license_id TEXT NOT NULL,product_code TEXT NOT NULL,email TEXT NOT NULL,operation TEXT NOT NULL,acquisition_channel TEXT NOT NULL,payment_status TEXT NOT NULL,amount_cents INTEGER,paid_at TEXT,external_order_ref TEXT,actor TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  `);
  const db:any={
    prepare(sql:string){const statement=sqlite.prepare(sql);return{bind(...args:any[]){return{async first(){return statement.get(...args)??null},async all(){return{results:statement.all(...args)}},async run(){const r=statement.run(...args);return{meta:{changes:Number(r.changes||0)}}}}}}},
    async batch(statements:any[]){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}},
  };
  return{db:db as D1Database,sqlite};
}

describe('Debora observability resilience',()=>{
  it('keeps manual licensing independent when observability is unavailable',async()=>{
    const {db,sqlite}=licenseDb();
    await expect(fetchDeboraObservability('/api/internal/observability/summary',{DB:db} as any)).rejects.toThrow(/debora_observability_unavailable/);

    const activated=await grantManualDeboraLicenseWithSale(db,'client@example.test',{
      acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000,externalOrderRef:'MLB-RESILIENCE',
    },'owner@example.test','2026-09-25T12:00:00.000Z');

    expect(activated.grant.status).toBe('active');
    expect(activated.sale.paymentStatus).toBe('paid');
    expect(sqlite.prepare("SELECT status FROM product_licenses WHERE email='client@example.test'").get().status).toBe('active');
    expect(sqlite.prepare("SELECT COUNT(*) total FROM manual_license_sales WHERE email='client@example.test'").get().total).toBe(1);
  });
});
