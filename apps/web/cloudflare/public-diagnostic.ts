/** Diagnóstico comercial público e isolado: não usa sessão, pagamentos nem IA externa. */
/** Avaliação comercial rápida: único formato público de envio.
 * Leads históricos do formulário antigo permanecem íntegros no D1 para consulta/reconciliação. */
const ENDPOINT = '/api/public/diagnostico';
const COLLECTION = 'artisys_diagnostic_leads_v1';
const DELIVERY_COLLECTION = 'artisys_diagnostic_deliveries_v1';
const str = (value:unknown)=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
type Diagnostic={
 name:string;company:string;email:string;whatsapp:string;goal:string;
 consent?:boolean;mode?:'quick'|'full'|'manual';
 utmSource?:string;utmMedium?:string;utmCampaign?:string;utmContent?:string;
 utmTerm?:string;videoTikTok?:string;
 /** Optional legacy metadata exists only on already stored leads, never new quick submissions. */
 teamSize?:string;sector?:string;painPoints?:string[];integrations?:string[];
 softwareSpend?:string;urgency?:string;
};
type QuickDiagnostic = {
  name:string; company:string; email:string; whatsapp:string; goal:string;
  consent:true; utmSource:string; utmMedium:string; utmCampaign:string;
  utmContent:string; utmTerm:string; videoTikTok:string; mode:'quick';
};
type QuickValidation={ok:true;value:QuickDiagnostic}|{ok:false;message:string};
export function validateQuickDiagnosticPayload(raw:unknown):QuickValidation {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {ok:false,message:'Informe os quatro campos da avaliação.'};
  const input=raw as Record<string,unknown>;
  const allowed=new Set(['kind','name','company','contact','goal','website','utm_source',
    'utm_medium','utm_campaign','utm_content','utm_term','video_tiktok']);
  if(input.kind!=='quick'||Object.keys(input).some(k=>!allowed.has(k)))return {ok:false,message:'Dados inválidos.'};
  const name=str(input.name),company=str(input.company);
  const rawContact=str(input.contact);
  const goal=typeof input.goal==='string'?input.goal.trim():'';
  let email='',whatsapp='';
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawContact)&&rawContact.length<=180)
    email=rawContact.toLowerCase();
  else {
    const digits=rawContact.replace(/\D/g,'');
    if(digits.length===10||digits.length===11)whatsapp='55'+digits;
    else if((digits.length===12||digits.length===13)&&digits.startsWith('55'))whatsapp=digits;
  }
  if(name.length<2||name.length>120||company.length<2||company.length>140)
    return {ok:false,message:'Informe seu nome e o da empresa.'};
  if(!email&&!whatsapp)return {ok:false,message:'Informe um e-mail ou WhatsApp válido para retorno.'};
  if(goal.length<15||goal.length>600)
    return {ok:false,message:'Descreva o desafio com pelo menos 15 e no máximo 600 caracteres.'};
  if(input.website)return {ok:false,message:'Envio não aceito.'};
  const campaign=(key:string)=>str(input[key]).slice(0,120);
  return {ok:true,value:{name,company,email,whatsapp,goal,consent:true,mode:'quick',
    utmSource:campaign('utm_source'),utmMedium:campaign('utm_medium'),
    utmCampaign:campaign('utm_campaign'),utmContent:campaign('utm_content'),
    utmTerm:campaign('utm_term'),videoTikTok:campaign('video_tiktok')}};
}

function respond(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', ...extra
  } });
}
async function rateLimit(request: Request, env: any) {
  // CF-Connecting-IP é emitido pela borda Cloudflare; nunca confiar em X-Forwarded-For do usuário.
  const ip = request.headers.get('cf-connecting-ip') || 'local-unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`artisys-diagnostic:${ip}`));
  const key = `public-diagnostic:${Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  const bucket = Math.floor(Date.now() / 86_400_000);
  const row = await env.DB.prepare(`INSERT INTO api_rate_limits(key,bucket,count,updated_at) VALUES(?,?,1,?)
    ON CONFLICT(key,bucket) DO UPDATE SET count=count+1,updated_at=excluded.updated_at RETURNING count`)
    .bind(key, bucket, new Date().toISOString()).first() as { count: number } | null;
  return (row?.count ?? 100) <= 5;
}

type DiagnosticWebhookContext = { waitUntil(promise: Promise<unknown>): void };

// D1 continua canônico; Activepieces recebe apenas dados mínimos para contato comercial.
// Variáveis secretas ficam no Worker, nunca no JavaScript público nem no repositório.
async function forwardDiagnosticLeadToActivepieces(
  lead: Partial<Diagnostic> & Pick<Diagnostic,'name'|'company'|'email'|'whatsapp'|'goal'>, protocol: string, env: any
): Promise<void> {
  const endpoint = env.ACTIVEPIECES_LEADS_WEBHOOK_URL;
  const token = env.ACTIVEPIECES_LEADS_WEBHOOK_TOKEN;
  if (typeof endpoint !== 'string' || !endpoint || typeof token !== 'string' || !token) return;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('Activepieces endpoint must use HTTPS');
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-artisys-leads-token': token },
    body: JSON.stringify({
      nome: lead.name,
      empresa: lead.company,
      email: lead.email,
      whatsapp: lead.whatsapp,
      origem: lead.utmSource || 'artisys.dev/links/diagnostico',
      utm_source: lead.utmSource,
      utm_medium: lead.utmMedium,
      utm_campaign: lead.utmCampaign,
      utm_content: lead.utmContent,
      utm_term: lead.utmTerm,
      video_tiktok: lead.videoTikTok,
      campanha: lead.utmCampaign,
      porte: lead.teamSize,
      desafios: lead.painPoints,
      integracoes: lead.integrations,
      gasto_software: lead.softwareSpend,
      produto: 'Diagnóstico empresarial',
      mensagem: lead.goal,
      setor: lead.sector,
      urgencia: lead.urgency,
      protocolo: protocol,
      contato_solicitado: true,
      consentimento: lead.consent === true
    })
  });
  if (!response.ok) throw new Error('Activepieces lead delivery failed');
}


async function markDiagnosticDelivered(id: string, env: any): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`)
    .bind(DELIVERY_COLLECTION, id, JSON.stringify({ deliveredAt: now }), now, now).run();
}

/** Reconcilia falhas de transporte. Não reenvia informações que tiveram aceite registrado. */
export async function reconcilePendingDiagnosticLeads(env: any): Promise<{ sent: number; failed: number }> {
  if (!env?.DB || !env.ACTIVEPIECES_LEADS_WEBHOOK_URL || !env.ACTIVEPIECES_LEADS_WEBHOOK_TOKEN) {
    return { sent: 0, failed: 0 };
  }
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const result = await env.DB.prepare(`SELECT lead.id,lead.record_json
    FROM kv_records lead
    LEFT JOIN kv_records delivery ON delivery.collection=? AND delivery.id=lead.id
    WHERE lead.collection=? AND delivery.id IS NULL AND lead.created_at>=?
    ORDER BY lead.created_at ASC LIMIT 25`)
    .bind(DELIVERY_COLLECTION,COLLECTION,cutoff).all() as { results?: Array<{id:string;record_json:string}> };
  let sent=0,failed=0;
  for (const row of result.results || []) {
    try {
      const record = JSON.parse(row.record_json) as Diagnostic;
      if (record.mode === 'manual') continue; // Owner-entered WhatsApp leads are never auto-forwarded.
      if (!record.name || !(record.email || record.whatsapp) || !record.goal) continue;
      await forwardDiagnosticLeadToActivepieces(record,row.id.slice(0,8).toUpperCase(),env);
      await markDiagnosticDelivered(row.id,env);
      sent++;
    } catch {
      failed++;
      console.warn('[diagnostic] Pending Activepieces delivery could not be completed');
    }
  }
  return { sent, failed };
}

export async function handlePublicDiagnostic(request: Request, env: any, ctx?: DiagnosticWebhookContext): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== ENDPOINT) return null;
  if (request.method !== 'POST') return respond({ ok: false, message: 'Método não permitido.' }, 405, { allow: 'POST' });
  const origin = request.headers.get('origin');
  if (origin !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return respond({ ok: false, message: 'Origem não autorizada.' }, 403);
  }
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return respond({ ok: false, message: 'Formato de envio inválido.' }, 415);
  }
  if (Number(request.headers.get('content-length') || 0) > 12_000) {
    return respond({ ok: false, message: 'Formulário muito grande.' }, 413);
  }
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 12_000) return respond({ ok: false, message: 'Formulário muito grande.' }, 413);
    raw = JSON.parse(text);
  } catch { return respond({ ok: false, message: 'Não foi possível ler os dados enviados.' }, 400); }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as Record<string, unknown>).website) {
    return respond({ ok: false, message: 'Envio não aceito.' }, 400);
  }
  const result=validateQuickDiagnosticPayload(raw);
  if(result.ok===false)return respond({ok:false,message:result.message},422);
  try {
    if (!await rateLimit(request, env)) return respond({ ok: false, message: 'Limite de envios atingido. Tente novamente amanhã.' }, 429);
    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const record = { ...result.value, receivedAt, source: '/links/diagnostico/', status: 'novo', version: 2, mode: 'quick' as const };
    await env.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(COLLECTION, id, JSON.stringify(record), receivedAt, receivedAt).run();
    // Falhas na integração não devem afetar protocolo, formulário ou dados já gravados.
    if (ctx?.waitUntil && env.ACTIVEPIECES_LEADS_WEBHOOK_URL && env.ACTIVEPIECES_LEADS_WEBHOOK_TOKEN) {
      ctx.waitUntil(
        forwardDiagnosticLeadToActivepieces(result.value, id.slice(0, 8).toUpperCase(), env)
          .then(() => markDiagnosticDelivered(id, env))
          .catch(() => { console.warn('[diagnostic] Activepieces forwarding failed'); })
      );
    }
    return respond({ ok: true, protocol: id.slice(0, 8).toUpperCase() }, 201);
  } catch {
    // Nunca exponha mensagens do D1, dados pessoais ou informações de infraestrutura.
    return respond({ ok: false, message: 'Não foi possível registrar agora. Tente novamente mais tarde.' }, 503);
  }
}