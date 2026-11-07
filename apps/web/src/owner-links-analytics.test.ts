// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindOwnerLinksAnalytics, ownerLinksAnalyticsSection } from './owner-links-analytics';

const payload = {
  days: 30, timezone: 'America/Sao_Paulo', views: 40, clicks: 8, interactionRate: 20,
  links: [
    { id: 'academy', label: 'ArtiSys Academy', clicks: 6 },
    { id: 'tiktok', label: 'TikTok', clicks: 2 }
  ],
  daily: [
    { date: '2026-11-06', views: 18, clicks: 5 },
    { date: '2026-11-07', views: 22, clicks: 3 }
  ]
};

describe('Painel de analytics integrado ao owner da Central ArtiSys', () => {
  beforeEach(() => {
    document.body.innerHTML = ownerLinksAnalyticsSection();
  });

  it('exibe totais e destinos apenas após consulta à API protegida', async () => {
    const get = vi.fn().mockResolvedValue({ data: payload });
    await bindOwnerLinksAnalytics({ get });
    expect(get).toHaveBeenCalledWith('/api/owner/links-analytics', { days: 30 });
    expect(document.querySelector('[data-owner-links-content]')?.textContent)
      .toContain('ArtiSys Academy');
    expect(document.querySelector('.owner-links-metrics')?.textContent).toContain('40');
    expect(document.querySelector('.owner-links-metrics')?.textContent).toContain('20%');
    expect(document.querySelectorAll('.owner-links-chart-day')).toHaveLength(2);
    expect(document.querySelectorAll('.owner-links-table-scroll table')).toHaveLength(2);
    expect(document.querySelector('a[href="/links/"]')).not.toBeNull();
    expect(document.body.textContent).toContain('não pessoas únicas');
  });

  it('aplica período e atualiza dados sem abrir novo login', async () => {
    const get = vi.fn().mockResolvedValue({ data: payload });
    await bindOwnerLinksAnalytics({ get });
    const period = document.querySelector<HTMLSelectElement>('[data-owner-links-period]')!;
    period.value = '7';
    period.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(get).toHaveBeenCalledWith('/api/owner/links-analytics', { days: 7 }));
    document.querySelector<HTMLButtonElement>('[data-owner-links-refresh]')!.click();
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('escapa rótulos recebidos da API e mostra falhas sem ocultar os controles', async () => {
    const get = vi.fn().mockResolvedValueOnce({
      data: { ...payload, links: [{ id: 'academy', label: '<img src=x onerror=alert(1)>', clicks: 8 }] }
    }).mockRejectedValueOnce(new Error('503'));
    await bindOwnerLinksAnalytics({ get });
    expect(document.querySelector('[data-owner-links-content] img')).toBeNull();
    expect(document.querySelector('[data-owner-links-content]')?.textContent)
      .toContain('<img src=x onerror=alert(1)>');
    document.querySelector<HTMLButtonElement>('[data-owner-links-refresh]')!.click();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull());
    expect(document.querySelector('[data-owner-links-period]')).not.toBeNull();
  });
});
