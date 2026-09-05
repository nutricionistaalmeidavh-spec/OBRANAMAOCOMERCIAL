(()=>{
  const content=document.getElementById('content');
  const sheet=document.getElementById('sheet');
  if(!content)return;

  const accessSurfaces=['login','claim','migration','preparing','mobile-unavailable','employee','error'];
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const lower=value=>clean(value).toLowerCase();

  function detectAccessSurface(){
    if(content.querySelector('.worker-head'))return 'employee';
    const authCard=content.querySelector(':scope .auth-page .auth-card');
    if(authCard){
      const title=lower(authCard.querySelector('h2')?.textContent);
      if(title.includes('gestão da obra em equipe'))return 'login';
      if(title.includes('ativar fluxodre'))return 'claim';
      if(title.includes('ativar dados compartilhados'))return 'migration';
      if(title.includes('não foi possível carregar a obra'))return 'error';
    }
    const text=lower(content.textContent);
    if(text.includes('obra em preparação'))return 'preparing';
    if(text.includes('mobile não contratado')||text.includes('sem operação mobile'))return 'mobile-unavailable';
    if(text.includes('acesso do funcionário')||text.includes('não foi possível carregar a obra'))return 'error';
    return '';
  }

  function accessCopy(surface){
    if(surface==='login')return{eyebrow:'ARTISYS · CAMPO',glyph:'A',tone:'blue'};
    if(surface==='claim')return{eyebrow:'PRIMEIRO ACESSO',glyph:'↗',tone:'blue'};
    if(surface==='migration')return{eyebrow:'DADOS COMPARTILHADOS',glyph:'⇄',tone:'teal'};
    if(surface==='preparing')return{eyebrow:'PREPARAÇÃO DA OBRA',glyph:'⌁',tone:'blue'};
    if(surface==='mobile-unavailable')return{eyebrow:'ACESSO MOBILE',glyph:'!',tone:'amber'};
    if(surface==='error')return{eyebrow:'NÃO FOI POSSÍVEL CONTINUAR',glyph:'!',tone:'red'};
    return{eyebrow:'MINHA ROTINA',glyph:'✓',tone:'blue'};
  }

  function ensureAccessVisual(card,surface){
    if(!card||card.querySelector(':scope > .access-visual'))return;
    const copy=accessCopy(surface);
    const visual=document.createElement('div');
    visual.className=`access-visual access-visual-${copy.tone}`;
    visual.innerHTML=`<span class="access-visual-glyph" aria-hidden="true">${copy.glyph}</span><span class="access-visual-label">${copy.eyebrow}</span><span class="access-visual-art" aria-hidden="true"></span>`;
    card.prepend(visual);
  }

  function enhanceAuthSurface(surface){
    const card=content.querySelector(':scope .auth-page .auth-card');
    if(!card)return;
    card.classList.add('premium-access-card',`premium-access-${surface}`);
    ensureAccessVisual(card,surface);
    card.querySelectorAll('input,select,textarea').forEach(el=>el.classList.add('premium-access-control'));
    card.querySelectorAll('.btn,.linkbtn').forEach(el=>el.classList.add('premium-access-action'));
    card.querySelectorAll('.notice,.card').forEach(el=>el.classList.add('premium-access-notice'));
  }

  function enhanceStateSurface(surface){
    const card=content.querySelector(':scope > .card')||content.querySelector(':scope .card');
    if(!card)return;
    card.classList.add('premium-access-state',`premium-access-state-${surface}`);
    if(!card.querySelector(':scope > .access-state-icon')){
      const icon=document.createElement('span');
      const copy=accessCopy(surface);
      icon.className=`access-state-icon access-state-icon-${copy.tone}`;
      icon.textContent=copy.glyph;
      icon.setAttribute('aria-hidden','true');
      card.prepend(icon);
    }
  }

  function enhanceEmployee(){
    const head=content.querySelector(':scope > .worker-head');
    if(head){
      head.classList.add('premium-worker-hero');
      if(!head.querySelector(':scope > .worker-hero-badge')){
        const badge=document.createElement('span');
        badge.className='worker-hero-badge';badge.textContent='Minha rotina';
        head.prepend(badge);
      }
      if(!head.querySelector(':scope > .worker-hero-art')){
        const art=document.createElement('span');art.className='worker-hero-art';art.setAttribute('aria-hidden','true');head.appendChild(art);
      }
    }
    content.querySelectorAll(':scope > .section').forEach((section,index)=>{
      section.classList.add('premium-worker-section');
      if(index===0)section.classList.add('premium-worker-today');
      else section.classList.add('premium-worker-week');
    });
    content.querySelectorAll('.task-card').forEach(card=>{
      card.classList.add('premium-worker-task');
      if(!card.querySelector(':scope > .worker-task-glyph')){
        const glyph=document.createElement('span');glyph.className='worker-task-glyph';glyph.textContent='↗';glyph.setAttribute('aria-hidden','true');card.prepend(glyph);
      }
    });
    content.querySelectorAll('.empty.card').forEach(card=>card.classList.add('premium-worker-empty'));
  }

  function enhanceAccountSheet(){
    if(!sheet)return;
    const panel=sheet.querySelector(':scope > .sheet');
    if(!panel)return;
    const title=lower(panel.querySelector('.sheet-head h2')?.textContent);
    if(title!=='minha conta')return;
    panel.classList.add('premium-account-sheet');
    panel.querySelectorAll('.btn,.linkbtn').forEach(el=>el.classList.add('premium-account-action'));
    if(!panel.querySelector(':scope > .account-sheet-mark')){
      const mark=document.createElement('div');mark.className='account-sheet-mark';mark.innerHTML='<span aria-hidden="true">A</span><div><small>ARTISYS</small><strong>Conta e acesso</strong></div>';panel.insertBefore(mark,panel.firstElementChild);
    }
  }

  function enhance(){
    const surface=detectAccessSurface();
    if(surface&&accessSurfaces.includes(surface)){
      content.dataset.accessSurface=surface;
      document.body.classList.add('field-access-active');
      if(surface==='employee')enhanceEmployee();
      else if(['login','claim','migration','error'].includes(surface)&&content.querySelector('.auth-page'))enhanceAuthSurface(surface);
      else enhanceStateSurface(surface);
      if(content.childElementCount>0)document.body.classList.remove('field-booting');
    }else{
      delete content.dataset.accessSurface;
      document.body.classList.remove('field-access-active');
    }
    enhanceAccountSheet();
  }

  document.addEventListener('field:rendered',enhance);
  document.addEventListener('field:sheet-rendered',enhanceAccountSheet);
  enhance();
})();

