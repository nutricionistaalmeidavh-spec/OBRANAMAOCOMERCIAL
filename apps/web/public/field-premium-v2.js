(()=>{
  const content=document.getElementById('content');
  const sheet=document.getElementById('sheet');
  if(!content)return;
  const glyphs=['◎','✓','↗','◫'];
  const backHref='./index.html#portal';
  const internalSurfaces=['floors','floor-detail','issues','planning','settings'];
  let lastPrimary='obra360';

  function ensureBack(host){
    if(!host||host.querySelector('.hero-back'))return;
    const link=document.createElement('a');
    link.className='hero-back';link.href=backHref;link.setAttribute('aria-label','Voltar ao painel geral');link.textContent='←';
    host.appendChild(link);
  }
  function normalizeQuickActions(container){
    if(!container)return;
    container.querySelectorAll(':scope > .quick-action').forEach((button,index)=>{
      if(button.classList.contains('quick-action-enhanced'))return;
      const title=button.querySelector(':scope > strong');
      const meta=button.querySelector(':scope > span');
      if(!title||!meta)return;
      const glyph=document.createElement('span');glyph.className='quick-action-glyph';glyph.textContent=glyphs[index]||'•';
      const copy=document.createElement('span');copy.className='quick-action-copy';copy.append(title,meta);
      button.prepend(copy);button.prepend(glyph);button.classList.add('quick-action-enhanced');
    });
  }
  function focusDayActions(){
    const actions=content.querySelector(':scope > .premium-quick-actions');
    if(!actions)return;
    actions.classList.add('day-focus-actions');
    actions.querySelectorAll('[data-screen="team"],[data-screen="more"],[data-screen="settings"]').forEach(button=>button.remove());
  }
  function shiftSecondaryActionsToObra360(actions){
    if(!actions)return;
    const dayButton=actions.querySelector(':scope > .quick-action[data-screen="today"]');
    if(dayButton){
      dayButton.dataset.screen='settings';
      const title=dayButton.querySelector(':scope > strong');
      const meta=dayButton.querySelector(':scope > span');
      if(title)title.textContent='Configurações';
      if(meta)meta.textContent='Checklists e horários';
    }
  }

  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim()}
  function firstHeading(){return cleanText(content.querySelector(':scope > .section-head h2,:scope > h2,:scope > .section-head strong')?.textContent)}
  function detectInternalSurface(){
    const existing=content.querySelector(':scope > .internal-hero')?.dataset.internalSurface;
    if(existing&&internalSurfaces.includes(existing))return existing;
    if(content.querySelector(':scope > .back[data-screen="floors"]'))return 'floor-detail';
    const title=firstHeading().toLowerCase();
    if(title.includes('pavimento'))return 'floors';
    if(title.includes('pendên'))return 'issues';
    if(title.includes('planejamento'))return 'planning';
    if(title.includes('configura'))return 'settings';
    return '';
  }
  function internalCopy(surface){
    const original=firstHeading();
    if(surface==='floor-detail')return{title:original||'Detalhe do pavimento',subtitle:'Etapas, avanço e checklists do pavimento',glyph:'▦'};
    if(surface==='floors')return{title:'Pavimentos',subtitle:'Etapas, checklists e avanço por pavimento',glyph:'▦'};
    if(surface==='issues')return{title:'Pendências',subtitle:'Qualidade, bloqueios e acompanhamento',glyph:'!'};
    if(surface==='planning')return{title:'Planejamento',subtitle:'Produtividade, previsão e ritmo da obra',glyph:'↗'};
    return{title:'Configurações',subtitle:'Checklists, horários e regras da operação',glyph:'⚙'};
  }
  function internalBackTarget(surface){
    if(surface==='floor-detail')return 'floors';
    if(surface==='issues'&&lastPrimary==='today')return 'today';
    return 'obra360';
  }
  function makeInternalHero(surface){
    const copy=internalCopy(surface),hero=document.createElement('section');
    hero.className=`internal-hero internal-hero-${surface}`;hero.dataset.internalSurface=surface;
    hero.innerHTML=`<div class="internal-hero-glyph" aria-hidden="true">${copy.glyph}</div><div class="internal-hero-copy"><h1>${copy.title}</h1><p>${copy.subtitle}</p></div><button type="button" class="internal-back" data-screen="${internalBackTarget(surface)}" aria-label="Voltar">←</button><div class="internal-hero-art" aria-hidden="true"></div>`;
    return hero;
  }
  function enhanceInternalSurface(surface){
    if(!internalSurfaces.includes(surface))return;
    content.dataset.surface=surface;
    if(!content.querySelector(':scope > .internal-hero'))content.insertBefore(makeInternalHero(surface),content.firstElementChild);
    content.querySelectorAll(':scope > .back').forEach(button=>button.classList.add('internal-back-legacy'));

    const heads=[...content.querySelectorAll(':scope > .section-head')].filter(head=>!head.closest('.internal-hero'));
    if(heads[0]){
      heads[0].classList.add('internal-primary-head');
      if(!heads[0].querySelector('button'))heads[0].classList.add('internal-primary-head-empty');
    }
    content.querySelectorAll('.empty').forEach(el=>el.classList.add('internal-empty'));
    content.querySelectorAll('.card').forEach(el=>el.classList.add('internal-card'));
    content.querySelectorAll('.quick-actions').forEach(normalizeQuickActions);

    if(surface==='floors')content.querySelectorAll('.floor,.floor-card').forEach(el=>el.classList.add('premium-floor-card'));
    if(surface==='floor-detail')content.querySelectorAll('.stage').forEach(el=>el.classList.add('premium-stage-card'));
    if(surface==='issues')content.querySelectorAll('.issue,.issue-card,.notice').forEach(el=>el.classList.add('premium-issue-card'));
    if(surface==='planning'){
      content.querySelectorAll('.planning-top').forEach(el=>el.classList.add('premium-planning-metrics'));
      content.querySelectorAll('.comparison-card').forEach(el=>el.classList.add('premium-comparison-card'));
      content.querySelectorAll('.productivity-card').forEach(el=>el.classList.add('premium-productivity-card'));
      content.querySelectorAll('.forecast').forEach(el=>el.classList.add('premium-forecast'));
    }
    if(surface==='settings'){
      content.querySelectorAll('.settings-card').forEach(el=>el.classList.add('premium-settings-card'));
      content.querySelectorAll('.check-admin-row').forEach(el=>el.classList.add('premium-check-row'));
      content.querySelectorAll('.config-label').forEach(el=>el.classList.add('premium-config-label'));
    }
  }

  function sheetTone(title){
    const value=title.toLowerCase();
    if(value.includes('pendên'))return 'issue';
    if(value.includes('planej'))return 'planning';
    if(value.includes('check')||value.includes('etapa'))return 'stage';
    if(value.includes('usuár')||value.includes('equipe'))return 'people';
    if(value.includes('config'))return 'settings';
    return 'default';
  }
  function enhanceSheet(){
    if(!sheet)return;
    const panel=sheet.querySelector(':scope > .sheet');
    if(!panel)return;
    panel.classList.add('premium-sheet');
    const title=cleanText(panel.querySelector('.sheet-head h2')?.textContent);
    panel.dataset.sheetTone=sheetTone(title);
    panel.querySelectorAll('.card').forEach(el=>el.classList.add('premium-sheet-card'));
    panel.querySelectorAll('input,select,textarea').forEach(el=>el.classList.add('premium-control'));
    panel.querySelectorAll('.btn,.linkbtn').forEach(el=>el.classList.add('premium-sheet-action'));
  }

  function enhance(){
    const active=document.querySelector('.nav button.active')?.dataset.screen||'';
    if(['today','obra360','team','management'].includes(active))lastPrimary=active;
    const internal=active?'':detectInternalSurface();
    content.dataset.surface=internal||active;

    if(active==='today')focusDayActions();

    if(active==='obra360'){
      const hero=content.querySelector(':scope > .hero');
      if(hero){hero.classList.add('field-hero','obra360-hero');ensureBack(hero)}
      const actions=content.querySelector(':scope > .quick-actions');
      if(actions){
        shiftSecondaryActionsToObra360(actions);
        actions.classList.add('obra360-actions');
        normalizeQuickActions(actions);
      }
    }

    if(active==='team'){
      const head=content.querySelector(':scope > .section-head');
      if(head){
        head.classList.add('field-hero','team-hero');ensureBack(head);
        if(!head.querySelector('.team-hero-glyph')){const glyph=document.createElement('span');glyph.className='team-hero-glyph';glyph.textContent='◎';head.prepend(glyph)}
      }
      content.querySelector(':scope > .card')?.classList.add('team-intro-card');
    }

    if(internal)enhanceInternalSurface(internal);
    enhanceSheet();
    if(content.childElementCount>0)document.body.classList.remove('field-booting');
  }

  const observer=new MutationObserver(()=>queueMicrotask(enhance));
  observer.observe(content,{childList:true});
  const sheetObserver=new MutationObserver(()=>queueMicrotask(enhanceSheet));
  if(sheet)sheetObserver.observe(sheet,{childList:true,subtree:true});
  document.addEventListener('click',event=>{if(event.target?.closest?.('[data-screen]'))requestAnimationFrame(enhance)},true);
  enhance();
})();
