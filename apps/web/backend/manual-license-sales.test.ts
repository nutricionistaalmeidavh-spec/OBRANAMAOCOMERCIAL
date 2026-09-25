import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migrationPath='cloudflare/migrations/0009_debora_manual_sales.sql';

describe('Debora manual sale persistence schema',()=>{
  it('creates the historical manual sales table with the expected columns and indexes',()=>{
    const sql=readFileSync(migrationPath,'utf8');
    const db=new DatabaseSync(':memory:');
    db.exec(sql);

    const columns=db.prepare("PRAGMA table_info('manual_license_sales')").all().map((row:any)=>row.name);
    expect(columns).toEqual(expect.arrayContaining([
      'id','license_id','product_code','email','operation','acquisition_channel','payment_status',
      'amount_cents','paid_at','external_order_ref','actor','created_at','updated_at',
    ]));

    const indexes=db.prepare("PRAGMA index_list('manual_license_sales')").all().map((row:any)=>row.name);
    expect(indexes).toEqual(expect.arrayContaining([
      'manual_license_sales_email_created_idx',
      'manual_license_sales_payment_created_idx',
      'manual_license_sales_channel_created_idx',
      'manual_license_sales_license_created_idx',
    ]));
  });
});
