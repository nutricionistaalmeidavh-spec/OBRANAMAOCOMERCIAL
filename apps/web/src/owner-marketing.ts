import { validateConsolidatedSources } from './marketing-analytics-canonical';
/** Proprietary-free owner experience for all ArtiSys marketing pages. */
type Page = {
  slug:string; name:string; category:string; path:string; href:string; images:string[];
  version?:number; customized?:boolean; updatedAt?:string|null;
  canonical?:string; robots?:string; hasStructuredData?:boolean;
  original?:Record<string,string>; effective?:{title:string;description:string;ogTitle:string;ogDescription:string;image:string};
};
type Summary = {views:number;productClicks:number;checkoutClicks:number;contactClicks:number;galleryClicks:number};
type Day={date:string;views:number;clicks:number};
type Home={views:number;clicks:number;destinations:Array<{id:string;label:string;clicks:number}>};
type Report = { days:number;timezone:string;summary:Summary; catalog:Summary;
  products:Array<{slug:string;name:string}&Summary>;
  daily:Array<{date:string}&Summary>;home:Home;homeDaily:Day[];note?:string };
type LinksReport={days:number;timezone:string;views:number;clicks:number;interactionRate:number;
  links:Array<{id:string;label:string;clicks:number}>;daily:Day[];note?:string };
type Api = {
  get:<T=any>(path:string,query?:Record<string,unknown>)=>Promise<{data:T}>;
  put:<T=any>(path:string,body?:unknown)=>Promise<{data:T}>;
  delete:<T=any>(path:string,body?:unknown)=>Promise<{data:T}>;
};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]||c));
const fmt=(n:number)=>Number(n||0).toLocaleString('pt-BR');

export function ownerMarketingSection() {
  return `<section class="owner-section owner-marketing" data-owner-marketing-panel>
    <div class="owner-section-head"><div>
      <span class="owner-eyebrow">ARTISYS · MARKETING</span>
      <h2>Marketing e SEO</h2>
      <p>Metadados das páginas comerciais e desempenho da vitrine, em uma única área. Nenhuma alteração de layout.</p>
    </div><a class="owner-secondary" href="/sistemas/" target="_blank" rel="noopener noreferrer">Abrir vitrine</a></div>

    <div class="owner-marketing-heading">
      <div><h3>Audiência e resultados por origem</h3><p>Dados separados de artisys.dev, /links e sistemas, sem identificar visitantes.</p></div>
      <div class="owner-marketing-actions"><label>Período
        <select data-marketing-days aria-label="Período de analytics">
          <option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option>
        </select></label>
        <button class="owner-secondary" data-marketing-refresh type="button">Atualizar</button></div>
    </div>
    <div data-owner-marketing-analytics aria-live="polite" role="region" aria-label="Indicadores de marketing">
      <div data-marketing-home role="region" aria-label="Página inicial artisys.dev"><p role="status">Carregando página inicial…</p></div>
      <div data-marketing-links role="region" aria-label="Central de links"><p role="status">Carregando /links…</p></div>
      <div data-marketing-commerce role="region" aria-label="Landing pages e vitrine"><p role="status">Carregando páginas comerciais…</p></div>
      <div data-marketing-integrity class="owner-marketing-note" role="status"></div>
    </div>
    <div class="owner-marketing-separator" aria-hidden="true"></div>
    <div class="owner-marketing-heading">
      <div><h3>Gerenciar SEO por sistema</h3><p>Edite títulos e descrições e publique imediatamente, mantendo as páginas intactas.</p></div>
    </div>
    <div class="owner-marketing-chooser"><label for="owner-marketing-product">Selecione a página
      <select id="owner-marketing-product" data-marketing-product aria-label="Selecionar landing page">
        <option value="">Carregando páginas…</option>
      </select></label>
      <div data-marketing-pages-status role="status"></div>
    </div>
    <div data-owner-marketing-editor>
      <p role="status">Carregando o editor de metadados…</p>
    </div>
  </section>`;
}

function chart(data:Report) {
  const rows=Array.isArray(data.daily)?data.daily:[];
  const peak=Math.max(1,...rows.map(day=>Number(day.views)||0),...rows.map(day=>Number(day.productClicks)||0));
  const bars=rows.map(day=>{
    const views=Math.max(0,Number(day.views)||0);
    const clicks=Math.max(0,Number(day.productClicks)||0);
    const height=n=>n===0?0:Math.max(3,Math.round(n/peak*110));
    const safeDate=/^\d{4}-\d{2}-\d{2}$/.test(day.date)?day.date:'';
    return `<div class="owner-marketing-day" title="${esc(safeDate)}: ${views} visualizações, ${clicks} cliques">
      <div class="owner-marketing-day-bars">
        <i class="owner-marketing-viewbar" style="height:${height(views)}px"></i>
        <i class="owner-marketing-clickbar" style="height:${height(clicks)}px"></i>
      </div>
      <small>${esc(safeDate.slice(8,10))}</small></div>`;
  }).join('');
  return `<div class="owner-marketing-chart-scroll"><div class="owner-marketing-chart" role="img" aria-label="Visualizações e cliques nos últimos ${data.days} dias">${bars}</div></div>`;
}
function analyticsView(data:Report) {
  const total=data.summary||{views:0,productClicks:0,checkoutClicks:0,contactClicks:0,galleryClicks:0};
  const values=[
    ['Aberturas comerciais',fmt(total.views),'Vitrine e landing pages; não são visitantes únicos'],
    ['Cliques da vitrine',fmt(total.productClicks),'Acessos aos produtos via catálogo'],
    ['Intenções de compra',fmt(total.checkoutClicks),'Cliques para comprar; não representam vendas'],
    ['Contatos',fmt(total.contactClicks),'Cliques de contato nas landing pages']
  ];
  const rank=(data.products||[]).slice().sort((a,b)=>b.productClicks-a.productClicks||b.checkoutClicks-a.checkoutClicks);
  return `<div class="owner-marketing-source-heading"><div><h4>Vitrine e landing pages</h4><p>Origem: /api/owner/marketing-analytics · somente páginas comerciais.</p></div><a href="/sistemas/" target="_blank" rel="noopener noreferrer">Abrir vitrine</a></div>
    <div class="owner-marketing-metrics">${values.map(([name,value,detail])=>`<div class="owner-marketing-metric"><span>${esc(name)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`).join('')}</div>
    <div class="owner-marketing-report"><h4>Movimento diário</h4>${chart(data)}
      <p class="owner-marketing-legend"><span><i class="owner-marketing-keyview"></i>Aberturas</span><span><i class="owner-marketing-keyclick"></i>Cliques na vitrine</span></p>
    </div>
    <div class="owner-marketing-report"><h4>Desempenho por sistema</h4>
      <div class="owner-marketing-tablewrap"><table><thead><tr><th>Sistema</th><th>Aberturas</th><th>Interesses</th><th>Intenções</th><th>Contatos</th></tr></thead>
        <tbody>${rank.map(p=>`<tr><th scope="row">${esc(p.name)}</th><td>${fmt(p.views)}</td><td>${fmt(p.productClicks)}</td><td>${fmt(p.checkoutClicks)}</td><td>${fmt(p.contactClicks)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>
    <p class="owner-marketing-note">As aberturas são carregamentos registrados, não visitantes únicos. Cliques não representam vendas ou leads confirmados. O total comercial não inclui a home nem /links.</p>`;
}


function simplifiedChart(rows:Day[],days:number,label:string) {
  const peak=Math.max(1,...rows.flatMap(x=>[x.views,x.clicks]));
  const bar=(n:number)=>n===0?0:Math.max(3,Math.round(n/peak*110));
  return `<div class="owner-marketing-chart-scroll"><div class="owner-marketing-chart" role="img" aria-label="${esc(label)}: aberturas e cliques por dia, período de ${days} dias">
    ${rows.map(day=>`<div class="owner-marketing-day" title="${esc(day.date)}: ${fmt(day.views)} aberturas e ${fmt(day.clicks)} cliques">
      <div class="owner-marketing-day-bars">
        <i class="owner-marketing-viewbar" style="height:${bar(day.views)}px"></i>
        <i class="owner-marketing-clickbar" style="height:${bar(day.clicks)}px"></i>
      </div><small>${esc(day.date.slice(8,10))}</small></div>`).join('')}
    </div></div><p class="owner-marketing-legend"><span><i class="owner-marketing-keyview"></i>Aberturas</span><span><i class="owner-marketing-keyclick"></i>Cliques</span></p>`;
}
function sourceMetrics(values:Array<[string,string,string]>) {
  return `<div class="owner-marketing-metrics">${values.map(([name,value,detail])=>
    `<div class="owner-marketing-metric"><span>${esc(name)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`
  ).join('')}</div>`;
}
function homeView(data:Report) {
  const home=data.home;
  const top=home.destinations.slice().sort((a,b)=>b.clicks-a.clicks);
  return `<div class="owner-marketing-source-heading"><div><h4>Página inicial · artisys.dev</h4>
    <p>Fonte: eventos first-party da página inicial. Não corresponde ao tráfego de todo o domínio.</p></div>
    <a href="/" target="_blank" rel="noopener noreferrer">Abrir home</a></div>
    ${sourceMetrics([
      ['Aberturas da home',fmt(home.views),'Carregamentos registrados; não são visitantes únicos'],
      ['Cliques na home',fmt(home.clicks),'Cliques para seções e páginas da ArtiSys'],
      ['Cliques por abertura',home.views?fmt(Math.round(home.clicks/home.views*1000)/10)+'%':'—','Pode superar 100%; não é conversão de usuários'],
      ['Destino mais clicado',top[0]?.clicks?top[0].label:'—',top[0]?.clicks?fmt(top[0].clicks)+' cliques':'Sem cliques registrados']
    ])}
    <div class="owner-marketing-report"><h4>Movimento da página inicial</h4>
      ${simplifiedChart(data.homeDaily,data.days,'Página inicial')}</div>
    <div class="owner-marketing-report"><h4>Cliques por destino · home</h4>
      <div class="owner-marketing-tablewrap"><table><thead><tr><th>Destino</th><th>Cliques</th><th>Participação</th></tr></thead>
        <tbody>${top.map(x=>`<tr><th scope="row">${esc(x.label)}</th><td>${fmt(x.clicks)}</td><td>${home.clicks?fmt(Math.round(x.clicks/home.clicks*1000)/10)+'%':'—'}</td></tr>`).join('')}</tbody>
      </table></div></div>`;
}
function linksView(data:LinksReport) {
  const top=data.links.slice().sort((a,b)=>b.clicks-a.clicks);
  return `<div class="owner-marketing-source-heading"><div><h4>Central de links · /links/</h4>
    <p>Fonte canônica existente: /api/owner/links-analytics; sem replicação de dados.</p></div>
    <a href="/links/" target="_blank" rel="noopener noreferrer">Abrir /links</a></div>
    ${sourceMetrics([
      ['Aberturas de /links',fmt(data.views),'Carregamentos registrados; não são visitantes únicos'],
      ['Cliques em /links',fmt(data.clicks),'Todos os destinos rastreados em /links'],
      ['Cliques por abertura',data.views?fmt(data.interactionRate)+'%':'—','Pode superar 100%; não é taxa de conversão'],
      ['Destino mais clicado',top[0]?.clicks?top[0].label:'—',top[0]?.clicks?fmt(top[0].clicks)+' cliques':'Sem cliques registrados']
    ])}
    <div class="owner-marketing-report"><h4>Movimento diário de /links</h4>
      ${simplifiedChart(data.daily,data.days,'Central de links')}</div>
    <div class="owner-marketing-report"><h4>Cliques por destino · /links</h4>
      <div class="owner-marketing-tablewrap"><table><thead><tr><th>Destino</th><th>Cliques</th><th>Participação</th></tr></thead>
        <tbody>${top.map(x=>`<tr><th scope="row">${esc(x.label)}</th><td>${fmt(x.clicks)}</td><td>${data.clicks?fmt(Math.round(x.clicks/data.clicks*1000)/10)+'%':'—'}</td></tr>`).join('')}</tbody>
      </table></div></div>
    <p class="owner-marketing-note">Os dados de /links vêm da mesma tabela e API do painel “Visitas e cliques”. Não há duplicação de contadores.</p>`;
}

function editorView(page:Page) {
  const data=page.effective||{title:'',description:'',ogTitle:'',ogDescription:'',image:''};
  const imageChoices=page.images || [];
  const selected=imageChoices.includes(data.image)?data.image:'';
  return `<form data-marketing-seo-form class="owner-marketing-form" novalidate>
    <div class="owner-marketing-status"><div>
      <span class="owner-marketing-state ${page.customized?'is-customized':''}" data-seo-state>${page.customized?'Publicado pelo painel':'Metadados padrão'}</span>
      <p>${esc(page.name)} · <a href="${esc(page.href)}" target="_blank" rel="noopener noreferrer">Abrir landing</a></p>
    </div><small>${page.updatedAt?'Última edição: '+esc(new Date(page.updatedAt).toLocaleString('pt-BR')):'Configuração de origem preservada'}</small></div>
    <div class="owner-marketing-fields">
      <label>Título SEO <span data-title-count></span>
        <input data-seo-title required name="title" minlength="10" maxlength="90" value="${esc(data.title)}" autocomplete="off">
      </label>
      <label>Meta description <span data-description-count></span>
        <textarea data-seo-description required name="description" minlength="45" maxlength="220" rows="3">${esc(data.description)}</textarea>
      </label>
      <label>Título para compartilhamento
        <input name="ogTitle" maxlength="100" value="${esc(data.ogTitle)}">
      </label>
      <label>Descrição para compartilhamento
        <textarea name="ogDescription" maxlength="240" rows="2">${esc(data.ogDescription)}</textarea>
      </label>
      <label>Imagem social (screenshots reais)
        <select name="image">
          <option value="">Sem imagem adicional</option>
          ${imageChoices.map(src=>`<option value="${esc(src)}" ${selected===src?'selected':''}>${esc(src.split('/').at(-1)||src)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="owner-marketing-preview">
      <h4>Prévia nos resultados de pesquisa</h4>
      <span data-seo-preview-url>${esc(page.canonical||page.href)}</span>
      <strong data-seo-preview-title>${esc(data.title)}</strong>
      <p data-seo-preview-description>${esc(data.description)}</p>
      <div class="owner-marketing-preview-image" data-seo-preview-image ${selected?'':'hidden'}>
        <img src="${esc(selected)}" alt="Prévia da imagem compartilhada" loading="lazy">
      </div>
    </div>
    <div class="owner-marketing-locked">
      <p><strong>Preservados:</strong> URL canônica, indexação, JSON-LD, layout, links de compra e conteúdo da página.</p>
      <p>Canonical: <code>${esc(page.canonical||page.href)}</code></p>
    </div>
    <div class="owner-marketing-form-actions">
      <button type="submit" class="owner-primary" data-seo-save>Publicar metadados</button>
      <button type="button" class="owner-secondary" data-seo-reset ${page.customized?'':'disabled'}>Restaurar originais</button>
      <p data-seo-message role="status" aria-live="polite"></p>
    </div>
  </form>`;
}

export async function bindOwnerMarketing(api:Api) {
  const panel=document.querySelector<HTMLElement>('[data-owner-marketing-panel]');
  const picker=panel?.querySelector<HTMLSelectElement>('[data-marketing-product]');
  const host=panel?.querySelector<HTMLElement>('[data-owner-marketing-editor]');
  const info=panel?.querySelector<HTMLElement>('[data-marketing-pages-status]');
  const metrics=panel?.querySelector<HTMLElement>('[data-owner-marketing-analytics]');
  const days=panel?.querySelector<HTMLSelectElement>('[data-marketing-days]');
  const refresh=panel?.querySelector<HTMLButtonElement>('[data-marketing-refresh]');
  if(!panel||!picker||!host||!metrics||!days) return;
  let chosen:Page|null=null;
  let requestId=0;
  const current=()=>panel.isConnected;

  let metricsVersion=0;
  async function loadMetrics() {
    const version=++metricsVersion;
    const button=refresh;
    if(button)button.disabled=true;
    const home=panel!.querySelector<HTMLElement>('[data-marketing-home]')!;
    const links=panel!.querySelector<HTMLElement>('[data-marketing-links]')!;
    const commerce=panel!.querySelector<HTMLElement>('[data-marketing-commerce]')!;
    const integrity=panel!.querySelector<HTMLElement>('[data-marketing-integrity]')!;
    home.innerHTML='<p role="status">Consultando página inicial…</p>';
    links.innerHTML='<p role="status">Consultando /links…</p>';
    commerce.innerHTML='<p role="status">Consultando páginas comerciais…</p>';
    integrity.textContent='';
    const period=Number(days!.value);
    const [marketingResult,linksResult]=await Promise.allSettled([
      api.get<Report>('/api/owner/marketing-analytics',{days:period}),
      api.get<LinksReport>('/api/owner/links-analytics',{days:period})
    ]);
    if(!current()||version!==metricsVersion)return;
    const marketing=marketingResult.status==='fulfilled'?marketingResult.value.data:null;
    const linkData=linksResult.status==='fulfilled'?linksResult.value.data:null;
    if(marketing&&linkData) {
      const check=validateConsolidatedSources(marketing,linkData);
      if(!check.valid) {
        const message='Inconsistência de canonicidade: '+check.issues.join('; ')+'. Indicadores ocultos até corrigir a origem.';
        for(const section of [home,links,commerce])section.innerHTML='<p role="alert">'+esc(message)+'</p>';
        integrity.textContent='As fontes não foram somadas nem substituídas por zeros.';
        if(button)button.disabled=false;
        return;
      }
      integrity.textContent='Dados auditados: datas, totais, ranking e séries conferem nas duas fontes. Fuso: Brasília. Sem união indevida de sessões.';
    } else {
      integrity.textContent='Uma fonte de métricas está indisponível; as outras permanecem separadas. Não foi feita soma parcial.';
    }
    if(marketing){
      home.innerHTML=homeView(marketing);
      commerce.innerHTML=analyticsView(marketing);
    } else {
      home.innerHTML='<p role="alert">Não foi possível carregar métricas da página inicial. Não substituímos dados ausentes por zero.</p>';
      commerce.innerHTML='<p role="alert">Não foi possível carregar métricas das landing pages. Tente atualizar.</p>';
    }
    if(linkData)links.innerHTML=linksView(linkData);
    else links.innerHTML='<p role="alert">Não foi possível carregar /links. Os dados do outro painel não foram copiados ou estimados.</p>';
    if(button)button.disabled=false;
  }
  function preview(form:HTMLFormElement) {
    const values=new FormData(form);
    const title=String(values.get('title')||'');
    const description=String(values.get('description')||'');
    form.querySelector<HTMLElement>('[data-seo-preview-title]')!.textContent=title;
    form.querySelector<HTMLElement>('[data-seo-preview-description]')!.textContent=description;
    form.querySelector<HTMLElement>('[data-title-count]')!.textContent=title.length+' / 90';
    form.querySelector<HTMLElement>('[data-description-count]')!.textContent=description.length+' / 220';
    const image=String(values.get('image')||'');
    const node=form.querySelector<HTMLElement>('[data-seo-preview-image]')!;
    node.hidden=!image;
    const picture=node.querySelector<HTMLImageElement>('img');
    if(picture&&chosen?.images.includes(image))picture.src=image;
  }
  function bindEditor() {
    const form=host!.querySelector<HTMLFormElement>('[data-marketing-seo-form]');
    if(!form||!chosen)return;
    preview(form);
    form.addEventListener('input',()=>preview(form));
    form.addEventListener('change',()=>preview(form));
    form.addEventListener('submit',async(event)=>{
      event.preventDefault();
      if(!chosen||!form.checkValidity()){form.reportValidity();return;}
      const submit=form.querySelector<HTMLButtonElement>('[data-seo-save]')!;
      const status=form.querySelector<HTMLElement>('[data-seo-message]')!;
      submit.disabled=true;status.textContent='Publicando os metadados…';
      const entries=new FormData(form);
      const payload={
        expectedVersion:chosen.version||0,
        title:String(entries.get('title')||'').trim(),
        description:String(entries.get('description')||'').trim(),
        ogTitle:String(entries.get('ogTitle')||'').trim(),
        ogDescription:String(entries.get('ogDescription')||'').trim(),
        image:String(entries.get('image')||'')
      };
      try {
        const {data}=await api.put<{page:Page}>('/api/owner/marketing-seo?slug='+encodeURIComponent(chosen.slug),payload);
        if(!current())return;
        chosen=data.page;
        host!.innerHTML=editorView(chosen);
        bindEditor();
        const statusNode=host!.querySelector<HTMLElement>('[data-seo-message]');
        if(statusNode) statusNode.textContent='Metadados publicados. A página visual permanece intacta.';
      } catch(error) { status.textContent=(error as Error).message||'Não foi possível salvar.'; }
      finally { if(submit.isConnected)submit.disabled=false; }
    });
    form.querySelector<HTMLButtonElement>('[data-seo-reset]')?.addEventListener('click',async()=>{
      if(!chosen?.customized)return;
      if(!window.confirm('Restaurar os metadados originais de '+chosen.name+'?'))return;
      const reset=form.querySelector<HTMLButtonElement>('[data-seo-reset]')!;
      reset.disabled=true;
      try {
        const {data}=await api.delete<{page:Page}>('/api/owner/marketing-seo?slug='+encodeURIComponent(chosen.slug)+'&version='+chosen.version);
        if(!current())return;
        chosen=data.page;host!.innerHTML=editorView(chosen);bindEditor();
        const message=host!.querySelector<HTMLElement>('[data-seo-message]');
        if(message)message.textContent='Metadados de origem restaurados.';
      } catch(error) {
        const status=form.querySelector<HTMLElement>('[data-seo-message]');
        if(status)status.textContent=(error as Error).message||'Não foi possível restaurar.';
        reset.disabled=false;
      }
    });
  }
  async function loadPage(slug:string) {
    const serial=++requestId;
    host!.innerHTML='<p role="status">Carregando dados de SEO…</p>';
    try {
      const {data}=await api.get<{page:Page}>('/api/owner/marketing-seo',{slug});
      if(!current()||serial!==requestId)return;
      chosen=data.page;
      host!.innerHTML=editorView(chosen);
      bindEditor();
    } catch {
      if(current()&&serial===requestId) host!.innerHTML='<p role="alert">Não foi possível consultar esta landing page.</p>';
    }
  }
  picker.addEventListener('change',()=>{if(picker.value)void loadPage(picker.value);});
  days.addEventListener('change',()=>void loadMetrics());
  refresh?.addEventListener('click',()=>void loadMetrics());
  void loadMetrics();
  try {
    const {data}=await api.get<{pages:Page[]}>('/api/owner/marketing-seo');
    if(!current())return;
    const pages=data.pages||[];
    picker.innerHTML=pages.map(p=>`<option value="${esc(p.slug)}">${esc(p.name)}${p.customized?' · Editado':''}</option>`).join('');
    if(info)info.textContent=pages.length+' páginas disponíveis';
    if(pages.length)void loadPage(pages[0].slug);
  } catch {
    if(current())host.innerHTML='<p role="alert">Não foi possível listar os sistemas. Confira sua sessão.</p>';
  }
}
