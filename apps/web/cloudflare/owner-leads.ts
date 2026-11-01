/** Leitura estritamente comercial, exclusiva do proprietário, reutilizando a sessão da Central ArtiSys. */
const COLLECTION='artisys_diagnostic_leads_v1';
const DELIVERY_COLLECTION='artisys_diagnostic_deliveries_v1';
const norm=(value:unknown,max=180)=>String(value??'').trim().slice(0,max);

export function scoreDiagnosticLead(row:Record<string,any>):{score:number;priority:'Alta'|'Media'|'Baixa'}{
  const urgency=norm(row.urgency,30);
  let points=({agora:25,'1-3m':18,'3-6m':10,explorando:4} as Record<string,number>)[urgency]??5;
  const people=norm(row.teamSize,30);
  if(['6-20','21-50','51+'].includes(people))points+=20;
  else if(people==='2-5')points+=10;
  const pain=Array.isArray(row.painPoints)?row.painPoints:[];
  points+=pain.length>=3?20:pain.length===2?13:pain.length===1?7:0;
  const spend=norm(row.softwareSpend,30);
  if(['501-1500','over1500'].includes(spend))points+=20;
  else if(spend==='201-500')points+=12;
  const integrations=Array.isArray(row.integrations)?row.integrations:[];
  if(integrations.some(x=>!['none','unknown'].includes(String(x))))points+=15;
  const score=Math.min(100,points);
  return {score,priority:score>=70?'Alta':score>=40?'Media':'Baixa'};
}

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8',
    'cache-control':'private, no-store','x-content-type-options':'nosniff','x-frame-options':'DENY',
    'referrer-policy':'no-referrer'}
});
type Env={DB:D1Database};
type Access=()=>Promise<Response>;

export async function handleOwnerLeadsRequest(request:Request,env:Env,authorize:Access):Promise<Response|null>{
  if(new URL(request.url).pathname!=='/api/owner/leads')return null;
  if(request.method!=='GET')return json({error:'Método não permitido.'},405);
  let role='';
  try {
    const access=await authorize();
    if(!access.ok)return json({error:'Acesso restrito ao proprietário da Central ArtiSys.'},403);
    role=String((await access.json() as {role?:string}).role||'');
  }catch{return json({error:'Não foi possível validar a sessão.'},403)}
  if(role!=='owner')return json({error:'Acesso restrito ao proprietário da Central ArtiSys.'},403);
  try{
    const rows=await env.DB.prepare(`SELECT lead.id,lead.record_json,lead.created_at,
      json_extract(delivery.record_json,'$.deliveredAt') AS delivered_at
      FROM kv_records lead LEFT JOIN kv_records delivery
        ON delivery.collection=? AND delivery.id=lead.id
      WHERE lead.collection=? ORDER BY lead.created_at DESC LIMIT 200`)
      .bind(DELIVERY_COLLECTION,COLLECTION).all<{id:string;record_json:string;created_at:string;delivered_at?:string|null}>();
    const leads=(rows.results||[]).flatMap(row=>{
      try{
        const record=JSON.parse(row.record_json) as Record<string,any>;
        const {score,priority}=scoreDiagnosticLead(record);
        return [{
          id:row.id,nome:norm(record.name,120),empresa:norm(record.company,140),
          email:norm(record.email,180),whatsapp:norm(record.whatsapp,24),
          setor:norm(record.sector,60),porte:norm(record.teamSize,30),
          objetivo:norm(record.goal,500),urgencia:norm(record.urgency,50),
          origem:norm(record.utmSource||record.source||'diagnostico',120),
          campanha:norm(record.utmCampaign,120),video:norm(record.videoTikTok,100),
          pontos:Array.isArray(record.painPoints)?record.painPoints.map((v:unknown)=>norm(v,70)).slice(0,3):[],
          recebidoEm:norm(record.receivedAt||row.created_at,40),
          score,prioridade:priority,entregue:!!row.delivered_at,
          protocolo:row.id.slice(0,8).toUpperCase(),status:norm(record.status||'novo',50)
        }];
      }catch{return []}
    });
    return json({leads,summary:{
      total:leads.length,alta:leads.filter(x=>x.prioridade==='Alta').length,
      tiktok:leads.filter(x=>x.origem.toLowerCase().includes('tiktok')).length,
      pendenteIntegracao:leads.filter(x=>!x.entregue).length
    },limit:200});
  }catch{
    return json({error:'Não foi possível carregar os diagnósticos agora.'},503);
  }
}
