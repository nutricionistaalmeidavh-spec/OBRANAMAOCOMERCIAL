import { normalizeManualSaleInput, type NormalizedManualSaleInput } from './debora-license-policy';
import { DEBORA_MANUAL_PLAN, DEBORA_PRODUCT_CODE, getManualDeboraLicense, normalizeLicenseEmail, prepareManualDeboraLicenseGrant } from './product-license-service';

export type ManualSaleRecord={
  id:string;licenseId:string;productCode:string;email:string;operation:'grant'|'renew'|'legacy_classification';
  acquisitionChannel:string;paymentStatus:string;amountCents:number|null;paidAt:string|null;externalOrderRef:string|null;
  actor:string;createdAt:string;updatedAt:string;
};

type Cursor={createdAt:string;id:string};
const enc=(value:Cursor)=>btoa(JSON.stringify(value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
function dec(value:string):Cursor{
  try{
    let raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/');while(raw.length%4)raw+='=';
    const parsed=JSON.parse(atob(raw));
    if(!parsed||typeof parsed.createdAt!=='string'||typeof parsed.id!=='string'||!parsed.createdAt||!parsed.id)throw new Error();
    return parsed;
  }catch{throw new Error('invalid_cursor')}
}
const pageLimit=(value:unknown,fallback=50)=>{const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(100,Math.floor(n))):fallback};

function row(record:any):ManualSaleRecord{return{
  id:String(record.id),licenseId:String(record.license_id),productCode:String(record.product_code),email:String(record.email),operation:record.operation,
  acquisitionChannel:String(record.acquisition_channel),paymentStatus:String(record.payment_status),amountCents:record.amount_cents===null?null:Number(record.amount_cents),
  paidAt:record.paid_at||null,externalOrderRef:record.external_order_ref||null,actor:String(record.actor||''),createdAt:String(record.created_at),updatedAt:String(record.updated_at),
}}

function insertSaleStatement(db:D1Database,input:{id:string;licenseId:string;email:string;operation:string;sale:NormalizedManualSaleInput;actor:string;now:string}){
  return db.prepare(`INSERT INTO manual_license_sales(
    id,license_id,product_code,email,operation,acquisition_channel,payment_status,
    amount_cents,paid_at,external_order_ref,actor,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    input.id,input.licenseId,DEBORA_PRODUCT_CODE,input.email,input.operation,input.sale.acquisitionChannel,input.sale.paymentStatus,
    input.sale.amountCents,input.sale.paidAt,input.sale.externalOrderRef,input.actor,input.now,input.now,
  );
}

export async function grantManualDeboraLicenseWithSale(db:D1Database,emailValue:unknown,saleValue:unknown,actor='central-artisys',now=new Date().toISOString()){
  const sale=normalizeManualSaleInput(saleValue);
  const prepared=await prepareManualDeboraLicenseGrant(db,emailValue,actor,now);
  const id=crypto.randomUUID();
  const statement=insertSaleStatement(db,{id,licenseId:prepared.result.id,email:prepared.result.email,operation:prepared.action,sale,actor,now});
  await db.batch([...prepared.statements,statement]);
  return{
    grant:prepared.result,
    sale:{id,licenseId:prepared.result.id,productCode:DEBORA_PRODUCT_CODE,email:prepared.result.email,operation:prepared.action,
      acquisitionChannel:sale.acquisitionChannel,paymentStatus:sale.paymentStatus,amountCents:sale.amountCents,paidAt:sale.paidAt,
      externalOrderRef:sale.externalOrderRef,actor,createdAt:now,updatedAt:now} as ManualSaleRecord,
  };
}

export async function manualSalesSummary(db:D1Database){
  const totals=await db.prepare(`SELECT
    COUNT(*) total,
    SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END) paid,
    SUM(CASE WHEN payment_status='pending' THEN 1 ELSE 0 END) pending,
    SUM(CASE WHEN payment_status='unpaid' THEN 1 ELSE 0 END) unpaid,
    SUM(CASE WHEN payment_status='not_applicable' THEN 1 ELSE 0 END) not_applicable,
    SUM(CASE WHEN payment_status='unknown' THEN 1 ELSE 0 END) unknown,
    SUM(CASE WHEN payment_status='paid' THEN COALESCE(amount_cents,0) ELSE 0 END) realized_revenue_cents
    FROM manual_license_sales WHERE product_code=?`).bind(DEBORA_PRODUCT_CODE).first<any>();
  const channels=await db.prepare(`SELECT acquisition_channel,COUNT(*) total FROM manual_license_sales
    WHERE product_code=? GROUP BY acquisition_channel`).bind(DEBORA_PRODUCT_CODE).all<{acquisition_channel:string;total:number}>();
  const byChannel:Record<string,number>={mercado_livre:0,direct_sale:0,shopee:0,gumroad:0,courtesy:0,partnership:0,other:0};
  for(const item of channels.results||[])if(item.acquisition_channel in byChannel)byChannel[item.acquisition_channel]=Number(item.total||0);
  return{
    total:Number(totals?.total||0),paid:Number(totals?.paid||0),pending:Number(totals?.pending||0),unpaid:Number(totals?.unpaid||0),
    notApplicable:Number(totals?.not_applicable||0),unknown:Number(totals?.unknown||0),realizedRevenueCents:Number(totals?.realized_revenue_cents||0),byChannel,
  };
}

export async function listManualSales(db:D1Database,query:Record<string,string|undefined>={}){
  const limit=pageLimit(query.limit,50),where=['product_code=?'],binds:any[]=[DEBORA_PRODUCT_CODE];
  const paymentStatus=String(query.paymentStatus||'').trim(),channel=String(query.channel||'').trim(),search=String(query.search||'').trim().toLowerCase();
  if(paymentStatus){where.push('payment_status=?');binds.push(paymentStatus)}
  if(channel){where.push('acquisition_channel=?');binds.push(channel)}
  if(search){where.push("(lower(email) LIKE ? OR lower(COALESCE(external_order_ref,'')) LIKE ?)");binds.push(`%${search}%`,`%${search}%`)}
  if(query.cursor){const cursor=dec(query.cursor);where.push('(created_at < ? OR (created_at = ? AND id < ?))');binds.push(cursor.createdAt,cursor.createdAt,cursor.id)}
  const result=await db.prepare(`SELECT id,license_id,product_code,email,operation,acquisition_channel,payment_status,amount_cents,paid_at,external_order_ref,actor,created_at,updated_at
    FROM manual_license_sales WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...binds,limit+1).all<any>();
  const records=(result.results||[]).map(row),hasMore=records.length>limit,items=records.slice(0,limit),last=items[items.length-1];
  return{items,hasMore,nextCursor:hasMore&&last?enc({createdAt:last.createdAt,id:last.id}):null};
}

export async function classifyLegacyManualSale(db:D1Database,emailValue:unknown,saleValue:unknown,actor='central-artisys',now=new Date().toISOString()){
  const email=normalizeLicenseEmail(emailValue);if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('invalid_email');
  const sale=normalizeManualSaleInput(saleValue);
  const license=await getManualDeboraLicense(db,email);if(!license)throw new Error('manual_license_not_found');
  if(sale.externalOrderRef){
    const duplicate=await db.prepare(`SELECT id FROM manual_license_sales WHERE product_code=? AND license_id=?
      AND operation='legacy_classification' AND external_order_ref=? LIMIT 1`).bind(DEBORA_PRODUCT_CODE,license.id,sale.externalOrderRef).first<any>();
    if(duplicate)throw new Error('duplicate_legacy_classification');
  }
  const id=crypto.randomUUID();
  await insertSaleStatement(db,{id,licenseId:license.id,email,operation:'legacy_classification',sale,actor,now}).run();
  return{id,licenseId:license.id,productCode:DEBORA_PRODUCT_CODE,email,operation:'legacy_classification' as const,
    acquisitionChannel:sale.acquisitionChannel,paymentStatus:sale.paymentStatus,amountCents:sale.amountCents,paidAt:sale.paidAt,
    externalOrderRef:sale.externalOrderRef,actor,createdAt:now,updatedAt:now,planCode:DEBORA_MANUAL_PLAN};
}

export const manualSalesCursor={encode:enc,decode:dec};
