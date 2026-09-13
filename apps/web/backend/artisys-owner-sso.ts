type OwnerSsoEnv = {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OWNER_EMAIL?: string;
};

type SsoStateRow = { target: string; expires_at: string };
type SsoCodeRow = { email: string; target: string; expires_at: string };

const DEBORA_SEO_TARGET = 'debora-seo';
const DEBORA_SEO_RETURN = 'https://deboralactacao.com/admin/seo/';
const SSO_TTL_MS = 10 * 60 * 1000;
let schemaReady: Promise<void> | null = null;

function clean(value: unknown) {
  return String(value || '').trim();
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function ensureSchema(env: OwnerSsoEnv) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS artisys_sso_states (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`).run();
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS artisys_sso_codes (
        code TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        target TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`).run();
      await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_artisys_sso_codes_expiry ON artisys_sso_codes(expires_at)').run();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function googleClientId(env: OwnerSsoEnv) {
  return clean(env.GOOGLE_CLIENT_ID);
}

function ownerEmail(env: OwnerSsoEnv) {
  return clean(env.OWNER_EMAIL).toLowerCase();
}

async function start(request: Request, env: OwnerSsoEnv) {
  const url = new URL(request.url);
  const target = clean(url.searchParams.get('target'));
  if (target !== DEBORA_SEO_TARGET) return json({ error: 'sso_target_not_allowed' }, 400);

  const clientId = googleClientId(env);
  if (!clientId) return json({ error: 'google_oauth_not_configured' }, 503);

  await ensureSchema(env);
  const state = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SSO_TTL_MS).toISOString();
  await env.DB.prepare('INSERT INTO artisys_sso_states(id,target,expires_at,created_at) VALUES(?,?,?,?)')
    .bind(state, target, expiresAt, now.toISOString()).run();

  const redirectUri = `${url.origin}/api/auth/callback`;
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.searchParams.set('client_id', clientId);
  google.searchParams.set('redirect_uri', redirectUri);
  google.searchParams.set('response_type', 'code');
  google.searchParams.set('scope', 'openid email profile');
  google.searchParams.set('state', state);
  google.searchParams.set('prompt', 'select_account');

  const response = Response.redirect(google.toString(), 302);
  response.headers.set('cache-control', 'no-store');
  return response;
}

async function callback(request: Request, env: OwnerSsoEnv) {
  const url = new URL(request.url);
  const state = clean(url.searchParams.get('state'));
  if (!state) return null;

  await ensureSchema(env);
  const stateRow = await env.DB.prepare('SELECT target,expires_at FROM artisys_sso_states WHERE id=?')
    .bind(state).first<SsoStateRow>();
  if (!stateRow) return null;

  await env.DB.prepare('DELETE FROM artisys_sso_states WHERE id=?').bind(state).run();
  const code = clean(url.searchParams.get('code'));
  if (!code || stateRow.expires_at < new Date().toISOString()) {
    return json({ error: 'sso_login_expired' }, 400);
  }

  const clientId = googleClientId(env);
  const clientSecret = clean(env.GOOGLE_CLIENT_SECRET);
  if (!clientId || !clientSecret) return json({ error: 'google_oauth_not_configured' }, 503);

  const redirectUri = `${url.origin}/api/auth/callback`;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const token = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  const idToken = clean(token.id_token);
  if (!tokenResponse.ok || !idToken) return json({ error: 'google_login_failed' }, 401);

  const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const info = await infoResponse.json().catch(() => ({})) as Record<string, unknown>;
  const email = clean(info.email).toLowerCase();
  const issuer = clean(info.iss);
  const verified = String(info.email_verified || '').toLowerCase() === 'true';
  const validIssuer = issuer === 'accounts.google.com' || issuer === 'https://accounts.google.com';
  if (!infoResponse.ok || clean(info.aud) !== clientId || !verified || !validIssuer) {
    return json({ error: 'google_identity_invalid' }, 401);
  }
  if (!ownerEmail(env) || email !== ownerEmail(env)) return json({ error: 'owner_not_authorized' }, 403);
  if (stateRow.target !== DEBORA_SEO_TARGET) return json({ error: 'sso_target_not_allowed' }, 403);

  const ssoCode = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SSO_TTL_MS).toISOString();
  await env.DB.prepare('INSERT INTO artisys_sso_codes(code,email,target,expires_at,created_at) VALUES(?,?,?,?,?)')
    .bind(ssoCode, email, stateRow.target, expiresAt, now.toISOString()).run();

  const destination = new URL(DEBORA_SEO_RETURN);
  destination.hash = `artisys_sso_code=${encodeURIComponent(ssoCode)}`;
  return new Response(null, {
    status: 302,
    headers: { location: destination.toString(), 'cache-control': 'no-store' },
  });
}

async function redeem(request: Request, env: OwnerSsoEnv) {
  await ensureSchema(env);
  let body: Record<string, unknown> = {};
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: 'invalid_request' }, 400); }
  const code = clean(body.code);
  if (!/^[a-f0-9]{64}$/i.test(code)) return json({ error: 'invalid_sso_code' }, 401);

  const row = await env.DB.prepare('DELETE FROM artisys_sso_codes WHERE code=? RETURNING email,target,expires_at')
    .bind(code).first<SsoCodeRow>();
  if (!row || row.expires_at < new Date().toISOString()) return json({ error: 'invalid_sso_code' }, 401);
  if (row.target !== DEBORA_SEO_TARGET || row.email.toLowerCase() !== ownerEmail(env)) {
    return json({ error: 'owner_not_authorized' }, 403);
  }
  return json({ ok: true, email: row.email.toLowerCase(), target: row.target });
}

export async function handleArtisysOwnerSso(request: Request, env: OwnerSsoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/api/artisys-sso/start' && request.method === 'GET') return start(request, env);
  if (url.pathname === '/api/artisys-sso/redeem' && request.method === 'POST') return redeem(request, env);
  if (url.pathname === '/api/auth/callback' && request.method === 'GET') return callback(request, env);
  return null;
}
