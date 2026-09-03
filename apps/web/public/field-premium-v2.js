(()=>{
  const content=document.getElementById('content');
  if(!content)return;
  const glyphs=['◎','✓','↗','◫'];
  const backHref='./index.html#portal';

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
  function enhance(){
    const active=document.querySelector('.nav button.active')?.dataset.screen||'';
    content.dataset.surface=active;

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

    if(content.childElementCount>0)document.body.classList.remove('field-booting');
  }

  const observer=new MutationObserver(()=>queueMicrotask(enhance));
  observer.observe(content,{childList:true});
  document.addEventListener('click',event=>{if(event.target?.closest?.('[data-screen]'))requestAnimationFrame(enhance)},true);
  enhance();
})();
