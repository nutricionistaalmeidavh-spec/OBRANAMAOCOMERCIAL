/** Leitura estritamente comercial, exclusiva do proprietário, reutilizando a sessão da Central ArtiSys. */
const COLLECTION='artisys_diagnostic_leads_v1';
const DELIVERY_COLLECTION='artisys_diagnostic_deliveries_v1';
const STAGE_COLLECTION='artisys_diagnostic_lead_status_v1';
const STAGES=['novo','em_contato','proposta','contratado','pago','em_execucao','entregue','perdido'] as const;
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
  const path=new URL(request.url).pathname;
  if(path!=='/api/owner/leads' && path!=='/api/owner/leads/status')return null;
  if(path==='/api/owner/leads' && request.method!=='GET' && request.method!=='POST')return json({error:'Método não permitido.'},405);
  if(path==='/api/owner/leads/status' && request.method!=='PUT')return json({error:'Método não permitido.'},405);
  let role='';
  try {
    const access=await authorize();
    if(!access.ok)return json({error:'Acesso restrito ao proprietário da Central ArtiSys.'},403);
    role=String((await access.json() as {role?:string}).role||'');
  }catch{return json({error:'Não foi possível validar a sessão.'},403)}
  if(role!=='owner')return json({error:'Acesso restrito ao proprietário da Central ArtiSys.'},403);
  if(path==='/api/owner/leads' && request.method==='POST'){
    const origin=request.headers.get('origin'),url=new URL(request.url);
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')
      return json({error:'Origem não autorizada.'},403);
    if(!(request.headers.get('content-type')||'').startsWith('application/json'))
      return json({error:'Formato inválido.'},415);
    let raw:Record<string,unknown>;
    try{
      const body=await request.text();
      if(body.length>2400)return json({error:'Requisição muito grande.'},413);
      raw=JSON.parse(body);
    }catch{return json({error:'JSON inválido.'},400)}
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||
       Object.keys(raw).some(k=>!['name','company','contact','goal'].includes(k)))
      return json({error:'Dados inválidos.'},400);
    const name=typeof raw.name==='string'?raw.name.trim():'';
    const company=typeof raw.company==='string'?raw.company.trim():'';
    const contact=typeof raw.contact==='string'?raw.contact.trim():'';
    const goal=typeof raw.goal==='string'?raw.goal.trim():'';
    if(name.length<2||name.length>120||company.length<2||company.length>140||
       goal.length<15||goal.length>600||
       [name,company,goal].some(x=>/[<>\x00-\x08]/.test(x)))
      return json({error:'Informe nome, empresa e descrição válida do serviço.'},400);
    let email='',whatsapp='';
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)&&contact.length<=180) email=contact.toLowerCase();
    else {
      const digits=contact.replace(/\D/g,'');
      if(digits.length===10||digits.length===11)whatsapp='55'+digits;
      else if((digits.length===12||digits.length===13)&&digits.startsWith('55'))whatsapp=digits;
    }
    if(!email&&!whatsapp)return json({error:'Informe WhatsApp ou e-mail válido.'},400);
    const now=new Date().toISOString(),id=crypto.randomUUID();
    const record={name,company,email,whatsapp,goal,mode:'manual',status:'novo',
      source:'whatsapp_manual',utmSource:'whatsapp_manual',
      consent:false,receivedAt:now,version:2};
    try{
      await env.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
        .bind(COLLECTION,id,JSON.stringify(record),now,now).run();
      return json({ok:true,id,protocol:id.slice(0,8).toUpperCase(),status:'novo',mode:'manual',
        note:'Contato registrado pelo proprietário, sem envio de mensagem e sem confirmar pagamento.'},201);
    }catch{return json({error:'Não foi possível cadastrar o contato manual.'},503)}
  }
  if(path==='/api/owner/leads/status'){
    const url=new URL(request.url), origin=request.headers.get('origin');
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')
      return json({error:'Origem não autorizada.'},403);
    if(!(request.headers.get('content-type')||'').startsWith('application/json'))
      return json({error:'Formato inválido.'},415);
    let raw:Record<string,unknown>;
    try {
      const body=await request.text();
      if(body.length>600)return json({error:'Requisição muito grande.'},413);
      raw=JSON.parse(body);
    }catch{return json({error:'JSON inválido.'},400)}
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(x=>!['id','status','expectedVersion'].includes(x))||
       typeof raw.id!=='string'||!/^[0-9a-f-]{36}$/i.test(raw.id)||
       typeof raw.status!=='string'||!(STAGES as readonly string[]).includes(raw.status)||
       !Number.isInteger(raw.expectedVersion)||Number(raw.expectedVersion)<0)
      return json({error:'Etapa ou registro inválido.'},400);
    try {
      const lead=await env.DB.prepare('SELECT id FROM kv_records WHERE collection=? AND id=?')
        .bind(COLLECTION,raw.id).first();
      if(!lead)return json({error:'Lead não encontrado.'},404);
      const version=Number(raw.expectedVersion);
      const timestamp=new Date().toISOString();
      const record={status:raw.status,version:version+1,updatedAt:timestamp,source:'owner_manual'};
      const write=await env.DB.prepare(
        'INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) '+
        "ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at "+
        "WHERE CAST(json_extract(kv_records.record_json,'$.version') AS INTEGER)=?"
      ).bind(STAGE_COLLECTION,raw.id,JSON.stringify(record),timestamp,timestamp,version).run();
      if(write?.meta?.changes===0)return json({error:'Etapa atualizada em outra sessão. Recarregue.'},409);
      return json({ok:true,version:version+1,status:raw.status,manual:true,
        note:'Situação comercial informada manualmente; não confirma pagamento no gateway.'});
    }catch{return json({error:'Não foi possível atualizar a etapa comercial.'},503)}
  }
  try{
    const rows=await env.DB.prepare(`SELECT lead.id,lead.record_json,lead.created_at,
      json_extract(delivery.record_json,'$.deliveredAt') AS delivered_at,
      progression.record_json AS progression_json
      FROM kv_records lead LEFT JOIN kv_records delivery
        ON delivery.collection=? AND delivery.id=lead.id
      LEFT JOIN kv_records progression
        ON progression.collection=? AND progression.id=lead.id
      WHERE lead.collection=? ORDER BY lead.created_at DESC LIMIT 200`)
      .bind(DELIVERY_COLLECTION,STAGE_COLLECTION,COLLECTION).all<{id:string;record_json:string;created_at:string;delivered_at?:string|null;progression_json?:string|null}>();
    const leads=(rows.results||[]).flatMap(row=>{
      try{
        const record=JSON.parse(row.record_json) as Record<string,any>;
        const ranking=scoreDiagnosticLead(record);
        const scored=record.mode!=='quick'&&record.mode!=='manual';
        const score=scored?ranking.score:null;
        const priority=scored?ranking.priority:'Não avaliada';
        const stage=JSON.parse(row.progression_json||'null') as {status?:string;version?:number}|null;
        const status=stage?.status && (STAGES as readonly string[]).includes(stage.status) ? stage.status : 'novo';
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
          protocolo:row.id.slice(0,8).toUpperCase(),status,statusVersion:stage?.version||0,
           mode:record.mode==='quick'?'quick':record.mode==='manual'?'manual':'full'
        }];
      }catch{return []}
    });
    return json({leads,summary:{
      total:leads.length,alta:leads.filter(x=>x.prioridade==='Alta').length,
      tiktok:leads.filter(x=>x.origem.toLowerCase().includes('tiktok')).length,
      pendenteIntegracao:leads.filter(x=>x.mode!=='manual'&&!x.entregue).length
    },limit:200});
  }catch{
    return json({error:'Não foi possível carregar os diagnósticos agora.'},503);
  }
}
