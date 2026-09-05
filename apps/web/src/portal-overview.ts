import { api } from './cloudflare-client';
import { canReadOverview, type OverviewAccess, type PortalOverview } from '../shared/portal-overview';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
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
    const date = data.updatedAt ? new Date(data.updatedAt).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : null;
    return `${attention.length ? `<section class="cp-section"><h2>Atenção hoje</h2><div class="cp-attention">${pending.length ? pending.map(item => `<a class="cp-attention-row" href="./gestao.html#gestao/${esc(item.key)}"><span><strong>${esc(item.value)} ${esc(item.label.toLocaleLowerCase('pt-BR'))}</strong><small>Consultar na Gestão</small></span><span aria-hidden="true">›</span></a>`).join('') : '<p class="cp-empty-inline">Nenhuma pendência nesses indicadores na última atualização.</p>'}</div></section>` : ''}
      <section class="cp-section cp-summary"><div class="cp-section-heading"><h2>Resumo da gestão</h2>${date ? `<small>Desktop · ${esc(date)}</small>` : ''}</div>
      ${metrics.length ? `<div class="cp-metrics">${metrics.map(item => `<div><span>${esc(item.label)}</span><strong>${esc(item.kind === 'money' ? money.format(item.value / 100) : item.value)}</strong></div>`).join('')}</div>` : '<p class="cp-empty-inline">Aguardando publicação de indicadores pelo Desktop.</p>'}</section>`;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401 || status === 403) return '';
    return '<section class="cp-section"><p class="cp-empty-inline" role="status">Não foi possível atualizar o resumo. Seus módulos continuam disponíveis.</p><button class="cp-text-button" id="retryOverview" type="button">Tentar novamente</button></section>';
  }
}
