import { error, json, runtimeEnv, type RouterRoutes } from '../cloudflare/sdk';
import { buildDeboraGrantPayload, normalizeDeboraLicenseEmail } from './debora-license-policy';

type DeboraLicenseEnv = { DEBORA_LICENSE_API_URL?: string; DEBORA_LICENSE_ADMIN_SECRET?: string };

function licenseEnv() {
  return runtimeEnv() as unknown as DeboraLicenseEnv;
}

function endpoint() {
  return String(licenseEnv().DEBORA_LICENSE_API_URL || '').trim().replace(/\/$/, '');
}

function secret() {
  return String(licenseEnv().DEBORA_LICENSE_ADMIN_SECRET || '').trim();
}

async function callDebora(body: Record<string, unknown>) {
  const url = endpoint(), key = secret();
  if (!url || !key) return { response: error('Integração de licenças da Débora ainda não configurada.', 503) };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-artisys-license-secret': key,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error === 'grant_not_found'
      ? 'Não existe licença manual para este e-mail.'
      : payload?.error === 'invalid_email'
        ? 'Informe um e-mail válido.'
        : 'Não foi possível atualizar a licença da Débora.';
    return { response: error(message, response.status >= 400 && response.status < 600 ? response.status : 502) };
  }
  return { payload };
}

export function createDeboraLicenseAdminRoutes(secured: RouterRoutes[string]): RouterRoutes {
  return {
    'POST /api/owner/debora-license': [
      ...secured,
      async (ctx) => {
        const input = (ctx.body || {}) as Record<string, unknown>;
        const action = String(input.action || 'grant');
        const email = normalizeDeboraLicenseEmail(input.email);
        if (!/^\S+@\S+\.\S+$/.test(email)) return error('Informe um e-mail válido.', 400);
        if (!['grant', 'status', 'revoke'].includes(action)) return error('Ação de licença inválida.', 400);

        const requestBody = action === 'grant'
          ? { ...buildDeboraGrantPayload(email), actor: ctx.user?.email || 'central-artisys' }
          : { action, email, actor: ctx.user?.email || 'central-artisys' };
        const result = await callDebora(requestBody);
        if (result.response) return result.response;
        return json(result.payload);
      },
    ],
  };
}
