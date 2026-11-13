/** Agregados diários da /links: sem identificadores, cookies, IPs, user agents ou URLs de destino. */
const COLLECTION = 'artisys_links_daily_v1';
const LINK_LABELS: Record<string, string> = {
  'site-logo': 'Site principal · logotipo',
  'site-principal': 'Site principal · topo',
  'diagnostico': 'Diagnóstico gratuito',
  'academy': 'ArtiSys Academy',
  'mercado-livre': 'Mercado Livre',
  'tiktok': 'TikTok',
  'whatsapp-social': 'WhatsApp'
};
type Db = { prepare: (sql: string) => {
  bind: (...args: unknown[]) => { run: () => Promise<unknown>; all: () => Promise<{ results?: CountRow[] }> }
} };
type Env = { DB: Db };
type CountRow = { id: string; count: number | string };
type Authorize = () => Promise<Response>;
type Day = { date: string; views: number; clicks: number };
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
});

export function brazilDay(now: Date): string {
  const pieces = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = (name: string) => pieces.find(x => x.type === name)?.value ?? '';
  return part('year') + '-' + part('month') + '-' + part('day');
}
function shiftDay(day: string, offset: number): string {
  const date = new Date(day + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function summarizeLinksAnalytics(rows: CountRow[], days: number, now: Date) {
  const today = brazilDay(now);
  const daily: Day[] = Array.from({ length: days }, (_, i) => ({
    date: shiftDay(today, i + 1 - days), views: 0, clicks: 0
  }));
  const indexed = new Map(daily.map(item => [item.date, item]));
  const counts = new Map(Object.keys(LINK_LABELS).map(id => [id, 0]));
  for (const row of rows) {
    const count = Math.max(0, Math.floor(Number(row.count) || 0));
    if (!count) continue;
    const match = /^(\d{4}-\d{2}-\d{2}):(view|click:[a-z0-9-]+)$/.exec(row.id);
    if (!match) continue;
    const day = indexed.get(match[1]);
    if (!day) continue;
    if (match[2] === 'view') {
      day.views += count;
    } else {
      const id = match[2].slice('click:'.length);
      if (!own(LINK_LABELS, id)) continue;
      day.clicks += count;
      counts.set(id, (counts.get(id) ?? 0) + count);
    }
  }
  const views = daily.reduce((sum, item) => sum + item.views, 0);
  const clicks = daily.reduce((sum, item) => sum + item.clicks, 0);
  const links = Object.entries(LINK_LABELS).map(([id, label]) => ({
    id, label, clicks: counts.get(id) ?? 0
  })).sort((a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label, 'pt-BR'));
  return {
    days, timezone: 'America/Sao_Paulo', views, clicks,
    interactionRate: views ? Math.round((clicks / views) * 1000) / 10 : 0,
    links, daily
  };
}
export async function handlePublicLinksEvent(
  request: Request, env: Env, now = new Date()
): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/api/links/metrics') return null;
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405);
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if ((origin && origin !== requestOrigin) || fetchSite === 'cross-site') {
    return response({ error: 'Origem não permitida.' }, 403);
  }
  if (Number(request.headers.get('content-length') || 0) > 256) {
    return response({ error: 'Evento inválido.' }, 400);
  }
  let data: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 256) return response({ error: 'Evento inválido.' }, 400);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response({ error: 'Evento inválido.' }, 400);
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return response({ error: 'Evento inválido.' }, 400);
  }
  const type = data.type;
  const linkId = data.linkId;
  const validView = type === 'view' && Object.keys(data).length === 1;
  const validClick = type === 'click' && typeof linkId === 'string' &&
    own(LINK_LABELS, linkId) && Object.keys(data).length === 2;
  if (!validView && !validClick) return response({ error: 'Evento inválido.' }, 400);
  const key = brazilDay(now) + ':' + (validView ? 'view' : 'click:' + linkId);
  const stamp = now.toISOString();
  try {
    // UPSERT com incremento atômico; só agregados. Nenhum dado pessoal persistido.
    await env.DB.prepare(
      "INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) " +
      "VALUES(?,?,'{\"count\":1}',?,?) " +
      "ON CONFLICT(collection,id) DO UPDATE SET " +
      "record_json=json_set(kv_records.record_json,'$.count', " +
      "COALESCE(CAST(json_extract(kv_records.record_json,'$.count') AS INTEGER),0)+1), " +
      "updated_at=excluded.updated_at"
    ).bind(COLLECTION, key, stamp, stamp).run();
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch {
    return response({ error: 'Métrica temporariamente indisponível.' }, 503);
  }
}

export async function handleOwnerLinksAnalytics(
  request: Request, env: Env, authorize: Authorize, now = new Date()
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/owner/links-analytics') return null;
  if (request.method !== 'GET') return response({ error: 'Método não permitido.' }, 405);
  try {
    const allowed = await authorize();
    if (!allowed.ok || (await allowed.json() as { role?: string }).role !== 'owner') {
      return response({ error: 'Acesso restrito ao proprietário.' }, 403);
    }
  } catch {
    return response({ error: 'Não foi possível validar a sessão.' }, 403);
  }
  const requested = url.searchParams.get('days') ?? '30';
  const days = Number(requested);
  if (!['7', '30', '90'].includes(requested) || !Number.isInteger(days)) {
    return response({ error: 'Período inválido.' }, 400);
  }
  const today = brazilDay(now);
  try {
    const rows = await env.DB.prepare(
      "SELECT id, CAST(json_extract(record_json,'$.count') AS INTEGER) AS count " +
      "FROM kv_records WHERE collection=? AND id >= ? AND id < ?"
    ).bind(COLLECTION, shiftDay(today, 1 - days) + ':', shiftDay(today, 1) + ':')
      .all();
    return response({ ...summarizeLinksAnalytics(rows.results ?? [], days, now),
      note: 'Dados agregados registrados a partir da publicação do rastreamento.' });
  } catch {
    return response({ error: 'Não foi possível carregar as métricas.' }, 503);
  }
}
