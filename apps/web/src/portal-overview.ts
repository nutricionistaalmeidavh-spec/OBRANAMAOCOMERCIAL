import { api } from './cloudflare-client';
import { canReadOverview, type OverviewAccess, type PortalOverview } from '../shared/portal-overview';
import { snapshotFreshness } from './summary-freshness';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
export function portalOverviewLoading():string{
  // Keep overview height and metric columns stable without exposing data before authorization.
  return `<section class="cp-section cp-summary cp-overview-skeleton" role="status" aria-busy="true" aria-label="Carregando resumo da gestão">
    <div class="cp-section-heading"><h2>Resumo da gestão</h2><small>Carregando indicadores…</small></div>
    <div class="cp-metrics" aria-hidden="true">
      <div><span class="cp-skeleton-line"></span><strong class="cp-skeleton-value"></strong></div>
      <div><span class="cp-skeleton-line"></span><strong class="cp-skeleton-value"></strong></div>
      <div><span class="cp-skeleton-line"></span><strong class="cp-skeleton-value"></strong></div>
    </div>
  </section>`;
}

export async function loadPortalOverview(context: OverviewAccess): Promise<string> {
  // Deny before requesting: an employee's browser must not fetch administrative data.
  if (!canReadOverview(context)) return '';
  try {
    const data = (await api.get<PortalOverview>('/api/portal/overview')).data;
    const allowed = new Set(context.access?.modules || []);
    const metrics = data.metrics.filter(item => allowed.has(item.key));
    const attention = data.attention.filter(item => allowed.has(item.key));
    const pending = attention.filter(item => item.value > 0);
    const money = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
    const freshness=snapshotFreshness(data.updatedAt),date=freshness.dateLabel;
    return `${attention.length ? `<section class="cp-section"><h2>Pendências da última atualização</h2><div class="cp-attention">${pending.length ? pending.map(item => `<a class="cp-attention-row" href="./gestao.html#gestao/${esc(item.key)}"><span><strong>${esc(item.value)} ${esc(item.label.toLocaleLowerCase('pt-BR'))}</strong><small>Consultar na Gestão</small></span><span aria-hidden="true">›</span></a>`).join('') : '<p class="cp-empty-inline">Nenhuma pendência nesses indicadores na última atualização.</p>'}</div></section>` : ''}
      <section class="cp-section cp-summary"><div class="cp-section-heading"><h2>Resumo da gestão</h2>${date ? `<small>Desktop · ${esc(date)}</small>` : ''}</div>
      <p class="cp-snapshot-status ${freshness.state==='stale'?'is-stale':''}" role="status">${esc(freshness.label)}</p>
      ${metrics.length ? `<div class="cp-metrics">${metrics.map(item => `<div><span>${esc(item.label)}</span><strong>${esc(item.kind === 'money' ? money.format(item.value / 100) : item.value)}</strong></div>`).join('')}</div>` : '<p class="cp-empty-inline">Aguardando publicação de indicadores pelo Desktop.</p>'}</section>`;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401 || status === 403) return '';
    return '<section class="cp-section"><p class="cp-empty-inline" role="status">Não foi possível atualizar o resumo. Seus módulos continuam disponíveis.</p><button class="cp-text-button" id="retryOverview" type="button">Tentar novamente</button></section>';
  }
}
