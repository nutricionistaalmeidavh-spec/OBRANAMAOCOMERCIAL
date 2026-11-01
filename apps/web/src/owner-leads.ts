/** Seção comercial integrada ao menu existente da Central ArtiSys; somente leitura. */
type Lead={
  id:string;nome:string;empresa:string;email:string;whatsapp:string;
  setor:string;porte:string;objetivo:string;urgencia:string;origem:string;
  campanha:string;video:string;pontos:string[];recebidoEm:string;score:number;
  prioridade:'Alta'|'Media'|'Baixa';entregue:boolean;protocolo:string;status:string;
};
type Payload={
  leads:Lead[];
  summary:{total:number;alta:number;tiktok:number;pendenteIntegracao:number};
  limit:number
};
type OwnerApi={get:<T=any>(path:string)=>Promise<{data:T}>};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]!));
const date=(value:string)=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'—'};
const formatPriority=(value:string)=>value==='Alta'?'Alta':value==='Media'?'Média':'Baixa';
export function ownerLeadsSection(){
  return `<section class="owner-section owner-leads-panel" data-owner-leads-panel>
    <div class="owner-section-head"><div>
      <span class="owner-eyebrow">CENTRAL ARTISYS · COMERCIAL</span>
      <h2>Leads e diagnósticos</h2>
      <p>Solicitações recebidas no formulário ArtiSys. Informações comerciais exibidas somente na sua sessão administrativa.</p>
    </div></div>
    <div data-owner-leads-content><p role="status" aria-live="polite">Carregando diagnósticos…</p></div>
  </section>`;
}
function row(lead:Lead){
  const phone=String(lead.whatsapp||'').replace(/\D/g,'');
  const wa=/^55\d{10,11}$/.test(phone)?`<a class="owner-primary" target="_blank" rel="noopener noreferrer" href="https://wa.me/${phone}">Abrir WhatsApp</a>`:'';
  const mail=lead.email?`<a class="owner-secondary" href="mailto:${encodeURIComponent(lead.email)}">Responder por e-mail</a>`:'';
  const pr=lead.prioridade==='Alta'?'alta':lead.prioridade==='Media'?'media':'baixa';
  return `<article class="owner-lead-row" data-lead-row data-search="${esc([lead.nome,lead.empresa,lead.email,lead.origem,lead.campanha,lead.objetivo].join(' ').toLowerCase())}" data-priority="${esc(pr)}">
    <div class="owner-lead-head"><div><h3>${esc(lead.empresa||lead.nome)}</h3><small>${esc(lead.nome)} · ${esc(lead.setor||'Segmento não informado')}</small></div>
      <span class="owner-lead-priority priority-${pr}">${esc(formatPriority(lead.prioridade))} · ${esc(lead.score)}/100</span></div>
    <div class="owner-lead-meta"><span>${esc(lead.origem||'Formulário')}</span><span>${esc(date(lead.recebidoEm))}</span><span>Protocolo ${esc(lead.protocolo)}</span>
      <span>${lead.entregue?'Recebido pela automação':'Aguardando confirmação da automação'}</span></div>
    <p class="owner-lead-goal">${esc(lead.objetivo||'Objetivo não informado')}</p>
    <details class="owner-lead-detail"><summary>Ver diagnóstico e campanha</summary>
      <p><strong>Prazo:</strong> ${esc(lead.urgencia||'—')} · <strong>Equipe:</strong> ${esc(lead.porte||'—')}</p>
      <p><strong>Dificuldades:</strong> ${esc(lead.pontos.join(', ')||'Não informadas')}</p>
      <p><strong>Campanha:</strong> ${esc(lead.campanha||'Não identificada')} ${lead.video?'· Vídeo '+esc(lead.video):''}</p>
    </details>
    <div class="owner-lead-actions">${wa}${mail}</div>
  </article>`;
}
export async function bindOwnerLeads(api:OwnerApi){
  const host=document.querySelector<HTMLElement>('[data-owner-leads-content]');
  if(!host)return;
  try{
    const {data}=await api.get<Payload>('/api/owner/leads');
    if(!host.isConnected)return;
    const leads=Array.isArray(data.leads)?data.leads:[];
    const s=data.summary||{total:0,alta:0,tiktok:0,pendenteIntegracao:0};
    host.innerHTML=`<div class="owner-leads-metrics">
        <div><small>Diagnósticos</small><strong>${esc(s.total)}</strong></div>
        <div><small>Alta prioridade</small><strong>${esc(s.alta)}</strong></div>
        <div><small>Origem TikTok</small><strong>${esc(s.tiktok)}</strong></div>
        <div><small>Pendentes de confirmação</small><strong>${esc(s.pendenteIntegracao)}</strong></div>
      </div>
      <div class="owner-leads-tools">
        <label>Buscar lead<input type="search" data-lead-search placeholder="Empresa, nome ou campanha" autocomplete="off"></label>
        <label>Prioridade<select data-lead-priority><option value="">Todas</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>
      </div>
      <div class="owner-leads-list" data-leads-list>${leads.length?leads.map(row).join(''):'<p class="owner-leads-empty">Ainda não há diagnósticos cadastrados.</p>'}</div>
      <p role="status" class="owner-leads-empty" data-leads-filter-empty hidden>Nenhum diagnóstico corresponde aos filtros.</p>
      <p class="owner-leads-footnote">Fonte: formulários armazenados no D1, até 200 mais recentes. Acompanhamento e rascunhos mais detalhados continuam no CRM Activepieces; nenhuma mensagem é enviada automaticamente.</p>`;
    const search=host.querySelector<HTMLInputElement>('[data-lead-search]');
    const priority=host.querySelector<HTMLSelectElement>('[data-lead-priority]');
    const filter=()=>{
      let visible=0;
      host.querySelectorAll<HTMLElement>('[data-lead-row]').forEach(el=>{
        const ok=(el.dataset.search||'').includes((search?.value||'').toLowerCase().trim())&&(!priority?.value||el.dataset.priority===priority.value);
        el.hidden=!ok;if(ok)visible++;
      });
      const noResults=host.querySelector<HTMLElement>('[data-leads-filter-empty]');
      if(noResults)noResults.hidden=visible>0||leads.length===0;
    };
    search?.addEventListener('input',filter);
    priority?.addEventListener('change',filter);
  }catch(error){
    if(!host.isConnected)return;
    host.textContent='';
    const p=document.createElement('p');p.setAttribute('role','alert');
    p.textContent='Não foi possível consultar os leads agora. Verifique sua sessão na Central ArtiSys.';
    host.appendChild(p);
  }
}
