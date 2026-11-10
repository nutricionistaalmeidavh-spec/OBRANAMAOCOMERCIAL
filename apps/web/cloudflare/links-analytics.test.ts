import { describe, expect, it, vi } from 'vitest';
import { handlePublicLinksEvent, handleOwnerLinksAnalytics, summarizeLinksAnalytics } from './links-analytics';

const fixedNow = new Date('2026-11-07T18:00:00.000Z');
const eventUrl = 'https://artisys.dev/api/links/metrics';
const dashboardUrl = 'https://artisys.dev/api/owner/links-analytics?days=7';
const owner = async () => new Response(JSON.stringify({ role: 'owner' }), { status: 200 });
function fakeEnv() {
  const counts = new Map<string, number>();
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => ({
      run: async () => {
        if (!sql.includes('ON CONFLICT')) throw new Error('Must use atomic increments');
        const key = String(values[1]);
        counts.set(key, (counts.get(key) || 0) + 1);
      },
      all: async () => ({
        results: [...counts].filter(([key]) => key >= String(values[1]) && key < String(values[2]))
          .map(([id, count]) => ({ id, count }))
      })
    })
  }));
  return { DB: { prepare }, counts };
}
const event = (payload: unknown, headers: Record<string, string> = {}) => new Request(eventUrl, {
  method: 'POST',
  headers: { origin: 'https://artisys.dev', 'content-type': 'text/plain;charset=UTF-8', ...headers },
  body: JSON.stringify(payload)
});

describe('Analytics da Central /links sem rastreamento pessoal', () => {
  it('não intercepta rotas existentes nem aceita origem de terceiro', async () => {
    const env = fakeEnv();
    expect(await handlePublicLinksEvent(new Request('https://artisys.dev/api/auth/me'), env as never, fixedNow)).toBeNull();
    const rejected = await handlePublicLinksEvent(event({ type: 'click', linkId: 'academy' }, { origin: 'https://site-invasor.test' }), env as never, fixedNow);
    expect(rejected?.status).toBe(403);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
  it('não grava eventos inválidos ou URLs arbitrárias', async () => {
    const env = fakeEnv();
    for (const payload of [{ type: 'click', linkId: 'outra-url' }, { type: 'view', email: 'teste@example.test' }, { type: 'click', linkId: '' }]) {
      expect((await handlePublicLinksEvent(event(payload), env as never, fixedNow))?.status).toBe(400);
    }
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
  it('agrega abertura e cliques por dia, atomicamente, sem armazenar IP, cookies ou UTM', async () => {
    const env = fakeEnv();
    for (const payload of [{ type: 'view' }, { type: 'click', linkId: 'academy' }, { type: 'click', linkId: 'academy' }, { type: 'click', linkId: 'tiktok' }]) {
      expect((await handlePublicLinksEvent(event(payload), env as never, fixedNow))?.status).toBe(204);
    }
    expect([...env.counts.keys()]).toEqual(expect.arrayContaining([
      '2026-11-07:view', '2026-11-07:click:academy', '2026-11-07:click:tiktok'
    ]));
    expect(JSON.stringify([...env.counts])).not.toMatch(/test@example|ip|utm|cookie/i);
    const response = await handleOwnerLinksAnalytics(new Request(dashboardUrl), env as never, owner, fixedNow);
    expect(response?.status).toBe(200);
    const data = await response!.json() as any;
    expect(data).toMatchObject({ days: 7, views: 1, clicks: 3, interactionRate: 300 });
    expect(data.links.find((x: any) => x.id === 'academy').clicks).toBe(2);
    expect(data.daily.at(-1)).toMatchObject({ date: '2026-11-07', views: 1, clicks: 3 });
    expect(data.daily).toHaveLength(7);
  });
  it('impede leitura anônima e por perfil Débora antes de consultar D1', async () => {
    for (const authorize of [
      async () => new Response('{}', { status: 401 }),
      async () => new Response(JSON.stringify({ role: 'debora' }), { status: 200 })
    ]) {
      const env = fakeEnv();
      const response = await handleOwnerLinksAnalytics(new Request(dashboardUrl), env as never, authorize, fixedNow);
      expect(response?.status).toBe(403);
      expect(env.DB.prepare).not.toHaveBeenCalled();
    }
  });
  it('não aceita períodos arbitrários e não executa consultas desnecessárias', async () => {
    const env = fakeEnv();
    const response = await handleOwnerLinksAnalytics(new Request('https://artisys.dev/api/owner/links-analytics?days=3650'), env as never, owner, fixedNow);
    expect(response?.status).toBe(400);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
  it('mantém a série temporal correta inclusive em mudança de mês', () => {
    const data = summarizeLinksAnalytics([
      { id: '2026-10-31:view', count: 5 },
      { id: '2026-11-01:view', count: 2 },
      { id: '2026-11-01:click:whatsapp-social', count: 1 }
    ], 7, new Date('2026-11-01T18:00:00Z'));
    expect(data.views).toBe(7);
    expect(data.clicks).toBe(1);
    expect(data.daily.at(-2)).toMatchObject({ date: '2026-10-31', views: 5 });
    expect(data.daily.at(-1)).toMatchObject({ date: '2026-11-01', views: 2, clicks: 1 });
  });
});
