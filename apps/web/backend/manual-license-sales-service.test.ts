import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { grantManualDeboraLicenseWithSale, listManualSales, manualSalesSummary } from './manual-license-sales';

function runtimeDb(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE product_accounts(product_code TEXT NOT NULL,email TEXT NOT NULL,status TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(product_code,email));
    CREATE TABLE product_licenses(id TEXT PRIMARY KEY,product_code TEXT NOT NULL,email TEXT NOT NULL,plan_code TEXT NOT NULL,status TEXT NOT NULL,starts_at TEXT NOT NULL,expires_at TEXT,source TEXT NOT NULL,external_ref TEXT NOT NULL DEFAULT '',metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE product_license_events(id TEXT PRIMARY KEY,license_id TEXT,product_code TEXT NOT NULL,email TEXT NOT NULL,action TEXT NOT NULL,actor TEXT,source TEXT,details_json TEXT,created_at TEXT NOT NULL);
    CREATE TABLE manual_license_sales(id TEXT PRIMARY KEY,license_id TEXT NOT NULL,product_code TEXT NOT NULL,email TEXT NOT NULL,operation TEXT NOT NULL CHECK(operation IN ('grant','renew','legacy_classification')),acquisition_channel TEXT NOT NULL CHECK(acquisition_channel IN ('mercado_livre','direct_sale','shopee','gumroad','courtesy','partnership','other')),payment_status TEXT NOT NULL CHECK(payment_status IN ('paid','pending','unpaid','not_applicable','unknown')),amount_cents INTEGER CHECK(amount_cents IS NULL OR amount_cents>=0),paid_at TEXT,external_order_ref TEXT,actor TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  `);
  const db:any={
    prepare(sql:string){
      const statement=sqlite.prepare(sql);
      return{bind(...args:any[]){return{
        async first(){return statement.get(...args)??null},
        async all(){return{results:statement.all(...args)}},
        async run(){const r=statement.run(...args);return{meta:{changes:Number(r.changes||0)}}},
      }}};
    },
    async batch(statements:any[]){
      sqlite.exec('BEGIN');
      try{const out=[];for(const statement of statements)out.push(await statement.run());sqlite.exec('COMMIT');return out}
      catch(error){sqlite.exec('ROLLBACK');throw error}
    },
  };
  return{db:db as D1Database,sqlite};
}

const paid={acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000,externalOrderRef:'MLB-1'};

describe('manual Debora sales service',()=>{
  it('creates one historical sale per grant/renew and preserves previous sales',async()=>{
    const {db}=runtimeDb();
    const first=await grantManualDeboraLicenseWithSale(db,'client@example.test',paid,'owner','2026-09-25T12:00:00.000Z');
    const second=await grantManualDeboraLicenseWithSale(db,'client@example.test',{...paid,externalOrderRef:'MLB-2'},'owner','2026-10-01T12:00:00.000Z');
    expect(first.sale.operation).toBe('grant');
    expect(second.sale.operation).toBe('renew');
    expect(second.grant.expires_at).toBe('2027-09-25T12:00:00.000Z');
    const list=await listManualSales(db,{limit:'10'});
    expect(list.items).toHaveLength(2);
    expect(new Set(list.items.map(item=>item.externalOrderRef))).toEqual(new Set(['MLB-1','MLB-2']));
  });

  it('rolls back license activation when commercial transaction insert fails',async()=>{
    const {db,sqlite}=runtimeDb();
    sqlite.exec(`CREATE TRIGGER fail_manual_sale BEFORE INSERT ON manual_license_sales BEGIN SELECT RAISE(ABORT,'sale_write_failed'); END;`);
    await expect(grantManualDeboraLicenseWithSale(db,'rollback@example.test',paid,'owner','2026-09-25T12:00:00.000Z')).rejects.toThrow();
    expect(sqlite.prepare("SELECT COUNT(*) total FROM product_licenses WHERE email='rollback@example.test'").get().total).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) total FROM product_accounts WHERE email='rollback@example.test'").get().total).toBe(0);
  });

  it('paginates deterministically and counts only paid values as realized revenue',async()=>{
    const {db}=runtimeDb();
    await grantManualDeboraLicenseWithSale(db,'one@example.test',{...paid,externalOrderRef:'A'},'owner','2026-09-25T12:00:00.000Z');
    await grantManualDeboraLicenseWithSale(db,'two@example.test',{acquisitionChannel:'direct_sale',paymentStatus:'pending',amountCents:9000,externalOrderRef:'B'},'owner','2026-09-25T12:00:00.000Z');
    await grantManualDeboraLicenseWithSale(db,'three@example.test',{acquisitionChannel:'courtesy',paymentStatus:'not_applicable'},'owner','2026-09-25T12:00:00.000Z');
    const p1=await listManualSales(db,{limit:'2'});expect(p1.items).toHaveLength(2);expect(p1.hasMore).toBe(true);
    const p2=await listManualSales(db,{limit:'2',cursor:p1.nextCursor||''});expect(p2.items).toHaveLength(1);
    expect(new Set([...p1.items,...p2.items].map(item=>item.email)).size).toBe(3);
    const summary=await manualSalesSummary(db);
    expect(summary.paid).toBe(1);expect(summary.pending).toBe(1);expect(summary.notApplicable).toBe(1);expect(summary.realizedRevenueCents).toBe(8000);
  });
});
