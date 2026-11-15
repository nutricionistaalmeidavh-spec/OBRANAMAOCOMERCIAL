/** Seção comercial integrada ao menu existente da Central ArtiSys; somente leitura. */
type Lead={
  id:string;nome:string;empresa:string;email:string;whatsapp:string;
  setor:string;porte:string;objetivo:string;urgencia:string;origem:string;
  campanha:string;video:string;pontos:string[];recebidoEm:string;score:number;
  prioridade:'Alta'|'Media'|'Baixa'|'Não avaliada';entregue:boolean;protocolo:string;status:string;statusVersion:number;mode:'quick'|'full'|'manual';
};
type Payload={
  leads:Lead[];
  summary:{total:number;alta:number;tiktok:number;pendenteIntegracao:number};
  limit:number
};
type OwnerApi={get:<T=any>(path:string)=>Promise<{data:T}>;put:<T=any>(path:string,body:unknown)=>Promise<{data:T}>;post:<T=any>(path:string,body:unknown)=>Promise<{data:T}>};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]!));
const date=(value:string)=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'—'};
const formatPriority=(value:string)=>value==='Alta'?'Alta':value==='Media'?'Média':value==='Baixa'?'Baixa':'Não avaliada';
const stages=[
  ['novo','Novo lead'],['em_contato','Em contato'],['proposta','Proposta enviada'],
  ['contratado','Contratação acordada'],['pago','Pagamento informado manualmente'],
  ['em_execucao','Em execução'],['entregue','Entregue'],['perdido','Não avançou']
] as const;
export function ownerLeadsSection(){
  return `<section class="owner-section owner-leads-panel" data-owner-leads-panel>
    <div class="owner-section-head"><div>
      <span class="owner-eyebrow">CENTRAL ARTISYS · COMERCIAL</span>
      <h2>Leads e diagnósticos</h2>
      <p>Solicitações recebidas no formulário ArtiSys. Informações comerciais exibidas somente na sua sessão administrativa.</p>
    </div></div>
    <details class="owner-manual-lead">
      <summary>Registrar contato recebido no WhatsApp</summary>
      <p>Cadastre também oportunidades que chegaram sem preencher formulário. Nenhuma mensagem será enviada automaticamente.</p>
      <form data-manual-lead-form>
        <label>Nome <input name="name" required minlength="2" maxlength="120" autocomplete="name" placeholder="Nome do contato"></label>
        <label>Empresa <input name="company" required minlength="2" maxlength="140" autocomplete="organization" placeholder="Nome da empresa"></label>
        <label>WhatsApp ou e-mail <input name="contact" required maxlength="180" placeholder="WhatsApp ou e-mail para retorno"></label>
        <label>Serviço ou necessidade <textarea name="goal" required minlength="15" maxlength="600" rows="3" placeholder="Ex.: sistema contratado, entrega em andamento..."></textarea></label>
        <button type="submit" class="owner-primary" data-manual-lead-save>Registrar oportunidade</button>
      </form>
    </details>
    <p role="status" data-manual-lead-message aria-live="polite"></p>
    <div data-owner-leads-content><p role="status" aria-live="polite">Carregando leads…</p></div>
  </section>`;
}
function row(lead:Lead){
  const phone=String(lead.whatsapp||'').replace(/\D/g,'');
  const wa=/^55\d{10,11}$/.test(phone)?`<a class="owner-primary" target="_blank" rel="noopener noreferrer" href="https://wa.me/${phone}">Abrir WhatsApp</a>`:'';
  const mail=lead.email?`<a class="owner-secondary" href="mailto:${encodeURIComponent(lead.email)}">Responder por e-mail</a>`:'';
  const pr=lead.prioridade==='Alta'?'alta':lead.prioridade==='Media'?'media':lead.prioridade==='Baixa'?'baixa':'nao-avaliada';
  return `<article class="owner-lead-row" data-lead-row data-search="${esc([lead.nome,lead.empresa,lead.email,lead.origem,lead.campanha,lead.objetivo].join(' ').toLowerCase())}" data-priority="${esc(pr)}">
    <div class="owner-lead-head"><div><h3>${esc(lead.empresa||lead.nome)}</h3><small>${esc(lead.nome)} · ${esc(lead.setor||'Segmento não informado')}</small></div>
      <span class="owner-lead-priority priority-${pr}">${esc(formatPriority(lead.prioridade))}${lead.score==null?'': ' · '+esc(lead.score)+'/100'}</span></div>
    <div class="owner-lead-meta"><span>${esc(lead.origem||'Formulário')}</span><span>${esc(date(lead.recebidoEm))}</span><span>Protocolo ${esc(lead.protocolo)}</span>
      <span>${lead.mode==='manual'?'Registrado manualmente, sem automação':lead.entregue?'Recebido pela automação':'Aguardando confirmação da automação'}</span><span>${lead.mode==='quick'?'Avaliação rápida (4 campos)':lead.mode==='manual'?'Contato manual':'Diagnóstico completo'}</span></div>
    <p class="owner-lead-goal">${esc(lead.objetivo||'Objetivo não informado')}</p>
    <details class="owner-lead-detail"><summary>Ver diagnóstico e campanha</summary>
      <p><strong>Prazo:</strong> ${esc(lead.urgencia||'—')} · <strong>Equipe:</strong> ${esc(lead.porte||'—')}</p>
      <p><strong>Dificuldades:</strong> ${esc(lead.pontos.join(', ')||'Não informadas')}</p>
      <p><strong>Campanha:</strong> ${esc(lead.campanha||'Não identificada')} ${lead.video?'· Vídeo '+esc(lead.video):''}</p>
    </details>
    <div class="owner-lead-stage" data-lead-stage-row data-id="${esc(lead.id)}" data-version="${Number(lead.statusVersion)||0}">
      <label>Etapa comercial
        <select data-lead-stage aria-label="Etapa comercial de ${esc(lead.empresa)}">
          ${stages.map(([value,label])=>`<option value="${value}" ${value===lead.status?'selected':''}>${esc(label)}</option>`).join('')}
        </select>
      </label>
      <button class="owner-secondary" type="button" data-lead-stage-save>Salvar etapa</button>
      <p class="owner-lead-stage-status" data-lead-stage-message role="status" aria-live="polite"></p>
    </div>
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
        <div><small>Leads registrados</small><strong>${esc(s.total)}</strong></div>
        <div><small>Alta prioridade</small><strong>${esc(s.alta)}</strong></div>
        <div><small>Origem TikTok</small><strong>${esc(s.tiktok)}</strong></div>
        <div><small>Pendentes de confirmação</small><strong>${esc(s.pendenteIntegracao)}</strong></div>
      </div>
      <div class="owner-leads-tools">
        <label>Buscar lead<input type="search" data-lead-search placeholder="Empresa, nome ou campanha" autocomplete="off"></label>
        <label>Prioridade<select data-lead-priority><option value="">Todas</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>
      </div>
      <div class="owner-leads-list" data-leads-list>${leads.length?leads.map(row).join(''):'<p class="owner-leads-empty">Ainda não há leads cadastrados.</p>'}</div>
      <p role="status" class="owner-leads-empty" data-leads-filter-empty hidden>Nenhum lead corresponde aos filtros.</p>
      <p class="owner-leads-footnote">Fonte: formulários e contatos manuais armazenados no D1, até 200 mais recentes. Acompanhamento e rascunhos mais detalhados continuam no CRM Activepieces; nenhuma mensagem é enviada automaticamente.</p>`;
    const form=document.querySelector<HTMLFormElement>('[data-manual-lead-form]');
    if(form)form.onsubmit=async event=>{
      event.preventDefault();
      if(!form.checkValidity()){form.reportValidity();return;}
      const button=form.querySelector<HTMLButtonElement>('[data-manual-lead-save]')!;
      const msg=document.querySelector<HTMLElement>('[data-manual-lead-message]');
      const values=new FormData(form);
      const payload={
        name:String(values.get('name')||'').trim(),company:String(values.get('company')||'').trim(),
        contact:String(values.get('contact')||'').trim(),goal:String(values.get('goal')||'').trim()
      };
      button.disabled=true;
      if(msg)msg.textContent='Registrando oportunidade…';
      try{
        const result=await api.post<{ok:boolean;protocol:string}>('/api/owner/leads',payload);
        if(!host.isConnected)return;
        if(msg)msg.textContent='Contato registrado com protocolo '+result.data.protocol+
          '. Você pode atualizar a etapa comercial abaixo.';
        form.reset();
        const fresh=host.cloneNode(false) as HTMLElement;
        host.replaceWith(fresh);
        void bindOwnerLeads(api);
      }catch(error){
        if(msg)msg.textContent=(error as Error).message||'Falha ao registrar oportunidade.';
      }finally{button.disabled=false;}
    };
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
    host.addEventListener('click',async event=>{
      const button=(event.target instanceof Element)?event.target.closest<HTMLButtonElement>('[data-lead-stage-save]'):null;
      if(!button)return;
      const item=button.closest<HTMLElement>('[data-lead-stage-row]');
      const select=item?.querySelector<HTMLSelectElement>('[data-lead-stage]');
      const status=item?.querySelector<HTMLElement>('[data-lead-stage-message]');
      if(!item||!select||!status||button.disabled)return;
      button.disabled=true;status.textContent='Salvando etapa…';
      try{
        const {data}=await api.put<{ok:boolean;version:number;status:string}>('/api/owner/leads/status',{
          id:item.dataset.id,status:select.value,expectedVersion:Number(item.dataset.version||0)
        });
        if(!host.isConnected)return;
        item.dataset.version=String(data.version);
        status.textContent='Etapa salva. Informações financeiras são manuais, não comprovantes de pagamento.';
      }catch(error){
        status.textContent=(error as Error).message||'Não foi possível salvar. Atualize o painel.';
      }finally{button.disabled=false;}
    });
  }catch(error){
    if(!host.isConnected)return;
    host.textContent='';
    const p=document.createElement('p');p.setAttribute('role','alert');
    p.textContent='Não foi possível consultar os leads agora. Verifique sua sessão na Central ArtiSys.';
    host.appendChild(p);
  }
}
