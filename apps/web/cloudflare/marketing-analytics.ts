import catalog from '../public/sistemas/products.json';
import { brazilDay } from './links-analytics';

/** Only daily aggregated counters in existing kv_records. No migrations, IP, UA or cookies. */
const COLLECTION = 'artisys_marketing_daily_v1';
const allowed = new Set((catalog.products as Array<{slug:string}>).map(p=>p.slug));
const types = ['view','product_click','checkout_click','contact_click','gallery_click'] as const;
type Type = typeof types[number];
type Data = {type:Type;product:string};
type CountRow = {id:string;count:number|string};
type Db = {prepare:(sql:string)=>{bind:(...values:unknown[])=>{run:()=>Promise<unknown>;all:()=>Promise<{results?:CountRow[]}>}}};
type Env = {DB:Db};
type Authorize = ()=>Promise<Response>;
const emptyCounts = () => ({ views:0,productClicks:0,checkoutClicks:0,contactClicks:0,galleryClicks:0 });
const labels:Record<Type,keyof ReturnType<typeof emptyCounts>> = {
  view:'views',product_click:'productClicks',checkout_click:'checkoutClicks',
  contact_click:'contactClicks',gallery_click:'galleryClicks'
};
function shiftDay(day:string,days:number) {
  const value=new Date(day+'T00:00:00Z');value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}
function json(body:unknown,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer'
  }});
}
function validEvent(raw:unknown): raw is Data {
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) return false;
  const event=raw as Record<string,unknown>;
  if(Object.keys(event).length!==2 || !('type' in event) || !('product' in event)) return false;
  if(typeof event.type!=='string' || !types.includes(event.type as Type)) return false;
  if(typeof event.product!=='string' || !(allowed.has(event.product) || event.product==='catalog')) return false;
  if(event.product==='catalog' && event.type!=='view') return false;
  return true;
}
export function summarizeMarketingAnalytics(
  rows:CountRow[],days:number,now:Date,
  products: Array<{slug:string;name:string}>
) {
  const today=brazilDay(now);
  const daily=Array.from({length:days},(_,i)=>({date:shiftDay(today,i+1-days),...emptyCounts()}));
  const dailyByDate=new Map(daily.map(row=>[row.date,row]));
  const productCounts=new Map(products.map(p=>[p.slug,{slug:p.slug,name:p.name,...emptyCounts()}]));
  const catalogCounts=emptyCounts();
  const summary=emptyCounts();
  for(const row of rows) {
    const match=/^(\d{4}-\d{2}-\d{2}):(view|product_click|checkout_click|contact_click|gallery_click):([a-z0-9-]+)$/.exec(row.id);
    if(!match)continue;
    const targetDay=dailyByDate.get(match[1]);if(!targetDay)continue;
    const type=match[2] as Type, product=match[3];
    const value=Math.max(0,Math.floor(Number(row.count)||0));
    if(!value || (product!=='catalog' && !productCounts.has(product))) continue;
    if(product==='catalog' && type!=='view')continue;
    const field=labels[type];
    targetDay[field]+=value;summary[field]+=value;
    if(product==='catalog')catalogCounts[field]+=value;
    else productCounts.get(product)![field]+=value;
  }
  return {
    days,timezone:'America/Sao_Paulo',summary,catalog:catalogCounts,
    products:[...productCounts.values()].sort((a,b)=>b.productClicks-a.productClicks || b.checkoutClicks-a.checkoutClicks || a.name.localeCompare(b.name,'pt-BR')),
    daily,
    note:'Cliques em comprar indicam intenção; não representam pedidos nem vendas confirmadas. Contadores anônimos sem identificadores pessoais.'
  };
}
export async function handlePublicMarketingEvent(request:Request,env:Env,now=new Date()): Promise<Response|null> {
  if(new URL(request.url).pathname!=='/api/marketing/metrics')return null;
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  const origin=request.headers.get('origin');
  const site=new URL(request.url).origin;
  const fetchSite=request.headers.get('sec-fetch-site');
  if((origin && origin!==site) || fetchSite==='cross-site')return json({error:'Origem não permitida.'},403);
  if(Number(request.headers.get('content-length')||0)>200)return json({error:'Evento inválido.'},400);
  let event:unknown;
  try {const body=await request.text();if(body.length>200)return json({error:'Evento inválido.'},400);event=JSON.parse(body);}
  catch{return json({error:'Evento inválido.'},400);}
  if(!validEvent(event))return json({error:'Evento inválido.'},400);
  const approved=event as Data;
  const key=brazilDay(now)+':'+approved.type+':'+approved.product;
  const date=now.toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,'{\"count\":1}',?,?) "+
      "ON CONFLICT(collection,id) DO UPDATE SET "+
      "record_json=json_set(kv_records.record_json,'$.count', "+
      "COALESCE(CAST(json_extract(kv_records.record_json,'$.count') AS INTEGER),0)+1), "+
      "updated_at=excluded.updated_at"
    ).bind(COLLECTION,key,date,date).run();
    return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
  } catch {return json({error:'Métrica temporariamente indisponível.'},503);}
}
export async function handleOwnerMarketingAnalytics(
  request:Request, env:Env, authorize:Authorize, now=new Date()
): Promise<Response|null> {
  const url=new URL(request.url);
  if(url.pathname!=='/api/owner/marketing-analytics')return null;
  if(request.method!=='GET')return json({error:'Método não permitido.'},405);
  try {
    const response=await authorize();
    if(!response.ok || (await response.json() as {role?:string}).role!=='owner')
      return json({error:'Acesso restrito.'},403);
  } catch {return json({error:'Sessão inválida.'},403);}
  const rawDays=url.searchParams.get('days')??'30';
  if(!['7','30','90'].includes(rawDays))return json({error:'Período inválido.'},400);
  const days=Number(rawDays), today=brazilDay(now);
  try {
    const rows=await env.DB.prepare(
      "SELECT id, CAST(json_extract(record_json,'$.count') AS INTEGER) AS count "+
      "FROM kv_records WHERE collection=? AND id >= ? AND id < ?"
    ).bind(COLLECTION,shiftDay(today,1-days)+':',shiftDay(today,1)+':').all();
    return json(summarizeMarketingAnalytics(rows.results??[],days,now,catalog.products));
  } catch {return json({error:'Métricas temporariamente indisponíveis.'},503);}
}
