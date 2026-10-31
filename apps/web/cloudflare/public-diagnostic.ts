/** Diagnóstico comercial público e isolado: não usa sessão, pagamentos nem IA externa. */
const ENDPOINT = '/api/public/diagnostico';
const COLLECTION = 'artisys_diagnostic_leads_v1';
const SECTORS = ['comercio', 'servicos', 'construcao', 'saude', 'agro', 'industria', 'educacao', 'outros'];
const TEAM_SIZES = ['1', '2-5', '6-20', '21-50', '51+'];
const PAIN_POINTS = [
  'tarefas-manuais', 'clientes-vendas', 'financeiro', 'estoque', 'operacao-projetos',
  'documentos', 'integracoes', 'dados-relatorios', 'outros'
];
const WEEKLY_HOURS = ['nao-sei', '0-2', '3-5', '6-10', '11+'];
const URGENCY = ['agora', '1-3m', '3-6m', 'explorando'];
const MIGRATION = ['sim', 'nao', 'nao-sei'];

type Diagnostic = {
  name: string; company: string; email: string; whatsapp: string; sector: string; teamSize: string;
  painPoints: string[]; currentSystems: string; weeklyHours: string; goal: string;
  urgency: string; migration: string; consent: true;
};
type Validation = { ok: true; value: Diagnostic } | { ok: false; message: string };
const reject = (message: string): Validation => ({ ok: false, message });
const str = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const inList = (value: string, list: readonly string[]) => list.includes(value);

export function validateDiagnosticPayload(raw: unknown): Validation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reject('Preencha os dados do diagnóstico.');
  const input = raw as Record<string, unknown>;
  const name = str(input.name), company = str(input.company);
  const email = str(input.email).toLowerCase();
  const whatsapp = str(input.whatsapp).replace(/[^\d]/g, '');
  const sector = str(input.sector), teamSize = str(input.teamSize);
  const currentSystems = typeof input.currentSystems === 'string' ? input.currentSystems.trim() : '';
  const weeklyHours = str(input.weeklyHours), goal = typeof input.goal === 'string' ? input.goal.trim() : '';
  const urgency = str(input.urgency), migration = str(input.migration);
  if (name.length < 2 || name.length > 120 || company.length < 2 || company.length > 140) return reject('Informe seu nome e o nome da empresa.');
  if (email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reject('Informe um e-mail válido.');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) return reject('Confira o WhatsApp informado.');
  if (!inList(sector, SECTORS) || !inList(teamSize, TEAM_SIZES)) return reject('Selecione o segmento e o tamanho da equipe.');
  const painPoints = input.painPoints;
  if (!Array.isArray(painPoints) || painPoints.length < 1 || painPoints.length > 3 ||
      new Set(painPoints).size !== painPoints.length || !painPoints.every(x => typeof x === 'string' && inList(x, PAIN_POINTS))) {
    return reject('Selecione de 1 a 3 dificuldades principais.');
  }
  if (currentSystems.length > 500 || goal.length < 10 || goal.length > 600) return reject('Descreva o principal resultado esperado, em até 600 caracteres.');
  if (!inList(weeklyHours, WEEKLY_HOURS) || !inList(urgency, URGENCY) || !inList(migration, MIGRATION)) {
    return reject('Revise as opções de tempo, prazo e migração de dados.');
  }
  if (input.consent !== true) return reject('É necessário consentir com o uso das informações para receber o diagnóstico.');
  return { ok: true, value: { name, company, email, whatsapp, sector, teamSize,
    painPoints: [...painPoints], currentSystems, weeklyHours, goal, urgency, migration, consent: true } };
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
    .bind(key, bucket, new Date().toISOString()).first<{ count: number }>();
  return (row?.count ?? 100) <= 5;
}

export async function handlePublicDiagnostic(request: Request, env: any): Promise<Response | null> {
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
  const result = validateDiagnosticPayload(raw);
  if (!result.ok) return respond({ ok: false, message: result.message }, 422);
  try {
    if (!await rateLimit(request, env)) return respond({ ok: false, message: 'Limite de envios atingido. Tente novamente amanhã.' }, 429);
    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const record = { ...result.value, receivedAt, source: '/links/diagnostico/', status: 'novo', version: 1 };
    await env.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(COLLECTION, id, JSON.stringify(record), receivedAt, receivedAt).run();
    return respond({ ok: true, protocol: id.slice(0, 8).toUpperCase() }, 201);
  } catch {
    // Nunca exponha mensagens do D1, dados pessoais ou informações de infraestrutura.
    return respond({ ok: false, message: 'Não foi possível registrar agora. Tente novamente mais tarde.' }, 503);
  }
}