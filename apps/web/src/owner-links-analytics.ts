/** Painel de cliques na Central ArtiSys existente, reutilizando a sessão owner. */
type Daily = { date: string; views: number; clicks: number };
type LinkCount = { id: string; label: string; clicks: number };
type Payload = {
  days: number; timezone: string; views: number; clicks: number;
  interactionRate: number; links: LinkCount[]; daily: Daily[]; note?: string
};
type OwnerApi = { get: <T = any>(path: string, query?: Record<string, unknown>) => Promise<{ data: T }> };
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[char]);
const number = (value: number) => Number(value || 0).toLocaleString('pt-BR');
const dateLabel = (day: string) => day.slice(8, 10) + '/' + day.slice(5, 7);
const metric = (name: string, value: string, detail: string) =>
  `<div class="owner-links-metric"><small>${escapeHtml(name)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail)}</span></div>`;

export function ownerLinksAnalyticsSection() {
  return `<section class="owner-section owner-links-panel" data-owner-links-panel>
    <div class="owner-section-head"><div>
      <span class="owner-eyebrow">CENTRAL ARTISYS · AUDIÊNCIA</span>
      <h2>Visitas e cliques</h2>
      <p>Aberturas da página /links e cliques nos destinos. Nenhum visitante é identificado.</p>
    </div><a class="owner-secondary" href="/links/" target="_blank" rel="noopener noreferrer">Abrir página</a></div>
    <div class="owner-links-tools"><label for="owner-links-period">Período
      <select id="owner-links-period" data-owner-links-period>
        <option value="7">Últimos 7 dias</option>
        <option value="30" selected>Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
      </select></label>
      <button class="owner-secondary" type="button" data-owner-links-refresh>Atualizar</button>
    </div>
    <div data-owner-links-content role="region" aria-live="polite" aria-label="Indicadores da Central ArtiSys">
      <p role="status">Carregando indicadores…</p>
    </div>
  </section>`;
}
function chart(daily: Daily[]) {
  const visible = daily.slice(-Math.min(daily.length, 30));
  const peak = Math.max(1, ...visible.map(item => Math.max(item.views, item.clicks)));
  return `<div class="owner-links-chart"><div class="owner-links-chart-scroll">
    <div class="owner-links-chart-grid" role="img" aria-label="Comparação diária de aberturas e cliques">
      ${visible.map(day => {
        const views = Math.max(0, Math.min(100, Math.round(day.views / peak * 100)));
        const clicks = Math.max(0, Math.min(100, Math.round(day.clicks / peak * 100)));
        const tooltip = dateLabel(day.date) + ': ' + number(day.views) + ' aberturas, ' + number(day.clicks) + ' cliques';
        return `<div class="owner-links-chart-day" title="${escapeHtml(tooltip)}">
          <div class="owner-links-chart-bars">
            <span class="owner-links-bar owner-links-bar-views" style="height:${views}%"></span>
            <span class="owner-links-bar owner-links-bar-clicks" style="height:${clicks}%"></span>
          </div><small>${dateLabel(day.date)}</small></div>`;
      }).join('')}
    </div></div>
    <div class="owner-links-legend"><span><i class="owner-links-key-views"></i>Aberturas</span><span><i class="owner-links-key-clicks"></i>Cliques</span></div>
  </div>`;
}
function details(data: Payload) {
  const top = data.links.find(link => link.clicks > 0);
  const sorted = Array.isArray(data.links) ? data.links : [];
  const daily = Array.isArray(data.daily) ? data.daily : [];
  return `<div class="owner-links-metrics">
      ${metric('Aberturas da /links', number(data.views), 'Carregamentos registrados')}
      ${metric('Cliques', number(data.clicks), 'Todos os destinos')}
      ${metric('Cliques por abertura', data.views ? number(data.interactionRate) + '%' : '—', 'Pode superar 100%')}
      ${metric('Destino mais clicado', top?.label || '—', top ? number(top.clicks) + ' cliques' : 'Sem cliques registrados')}
    </div>
    <div class="owner-links-detail">
      <h3>Movimento diário</h3>
      ${chart(daily)}
      <details><summary>Ver totais por dia</summary>
        <div class="owner-links-table-scroll"><table><thead><tr><th scope="col">Data</th><th scope="col">Aberturas</th><th scope="col">Cliques</th></tr></thead>
          <tbody>${daily.slice().reverse().map(day => `<tr><td>${escapeHtml(dateLabel(day.date))}</td><td>${number(day.views)}</td><td>${number(day.clicks)}</td></tr>`).join('')}</tbody>
        </table></div>
      </details>
    </div>
    <div class="owner-links-detail">
      <h3>Cliques por destino</h3>
      <div class="owner-links-table-scroll"><table><thead><tr><th scope="col">Destino</th><th scope="col">Cliques</th><th scope="col">Participação</th></tr></thead>
        <tbody>${sorted.map(link => `<tr><td>${escapeHtml(link.label)}</td><td>${number(link.clicks)}</td><td>${data.clicks ? number(Math.round(link.clicks / data.clicks * 1000) / 10) + '%' : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>
    <p class="owner-links-footnote">Medição iniciada na publicação deste recurso; visitas anteriores permanecem disponíveis no Cloudflare Web Analytics. Os valores representam aberturas e cliques, não pessoas únicas. Horário: Brasília. Não são armazenados IP, cookies, identificadores ou dados pessoais.</p>`;
}

export async function bindOwnerLinksAnalytics(api: OwnerApi) {
  const host = document.querySelector<HTMLElement>('[data-owner-links-content]');
  const period = document.querySelector<HTMLSelectElement>('[data-owner-links-period]');
  const refresh = document.querySelector<HTMLButtonElement>('[data-owner-links-refresh]');
  if (!host || !period) return;
  let attempt = 0;
  const load = async () => {
    const current = ++attempt;
    host.innerHTML = '<p role="status">Carregando indicadores…</p>';
    if (refresh) refresh.disabled = true;
    try {
      const { data } = await api.get<Payload>('/api/owner/links-analytics', { days: Number(period.value) });
      if (!host.isConnected || current !== attempt) return;
      host.innerHTML = details(data);
    } catch {
      if (!host.isConnected || current !== attempt) return;
      host.innerHTML = '<p role="alert">Não foi possível carregar as métricas. Verifique sua sessão e tente novamente.</p>';
    } finally {
      if (current === attempt && refresh) refresh.disabled = false;
    }
  };
  period.addEventListener('change', () => { void load(); });
  refresh?.addEventListener('click', () => { void load(); });
  await load();
}
