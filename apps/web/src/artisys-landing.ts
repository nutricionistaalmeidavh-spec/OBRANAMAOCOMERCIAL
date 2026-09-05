import './artisys-landing.css';
import './artisys-refinement.css';

const menu = document.getElementById('nav-links');
const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
const menuIcon = '<path d="M4 7h16M4 12h16M4 17h16"/>';
const closeIcon = '<path d="m6 6 12 12M6 18 18 6"/>';

function setMenu(open: boolean) {
  menu?.classList.toggle('is-open', open);
  toggle?.setAttribute('aria-expanded', String(open));
  toggle?.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  const svg = toggle?.querySelector('svg');
  if (svg) svg.innerHTML = open ? closeIcon : menuIcon;
}

toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});

const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const panels = [...document.querySelectorAll<HTMLElement>('[data-preview-mode]')];
const panel = document.getElementById('preview-panel');
const windowLabel = document.querySelector('.window-bar > span:nth-child(2)');
let selected = 0;

function selectTab(index: number, focus = false) {
  selected = index;
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
  panels.forEach((item, i) => { item.hidden = i !== index; });
  panel?.setAttribute('aria-labelledby', tabs[index].id);
  if (panel) panel.dataset.mode = String(index);
  if (windowLabel) windowLabel.textContent = `seu negócio / ${tabs[index].textContent?.toLowerCase()}`;
  if (focus) tabs[index].focus();
}

tabs.forEach((tab, index) => tab.addEventListener('click', () => selectTab(index)));
document.querySelector('[role="tablist"]')?.addEventListener('keydown', event => {
  const key = (event as KeyboardEvent).key;
  const index = key === 'ArrowRight' ? (selected + 1) % tabs.length
    : key === 'ArrowLeft' ? (selected + tabs.length - 1) % tabs.length
    : key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 : undefined;
  if (index !== undefined) { event.preventDefault(); selectTab(index, true); }
});
selectTab(0);

function refineHeroPreview() {
  const dashboard = document.querySelector<HTMLElement>('[data-preview-mode="0"] .dashboard');
  if (!dashboard) return;

  const micro = dashboard.querySelector('.dashboard-top .micro');
  const title = dashboard.querySelector('.dashboard-top h3');
  if (micro) micro.textContent = 'OPERAÇÃO EM UM SÓ LUGAR';
  if (title) title.textContent = 'Sua operação, em movimento.';

  const metrics = dashboard.querySelectorAll<HTMLElement>('.dashboard-metrics > div');
  if (metrics[0]) {
    const label = metrics[0].querySelector('span');
    const value = metrics[0].querySelector('strong');
    if (label) label.textContent = 'Projetos em andamento';
    if (value) value.textContent = 'Acompanhe prioridades';
  }
  if (metrics[1]) {
    const label = metrics[1].querySelector('span');
    const value = metrics[1].querySelector('strong');
    if (label) label.textContent = 'Equipe e processos';
    if (value) value.textContent = 'Tudo conectado';
  }

  const chartTitle = dashboard.querySelector('.chart-header > span:first-child');
  if (chartTitle) chartTitle.textContent = 'Pulso da operação';
  const chart = dashboard.querySelector('.cash-chart');
  chart?.setAttribute('aria-label', 'Exemplo visual ilustrativo do pulso de uma operação, sem dados reais');
  const task = dashboard.querySelector('.preview-task > span:nth-child(2)');
  if (task) task.textContent = 'Próximos passos e rotinas organizados';
}

const solutionVisuals = [
  `<div class="site-stage">
    <div class="site-stage-bar"><span class="stage-dots"><i></i><i></i><i></i></span><span>presença digital</span></div>
    <div class="site-stage-body">
      <div class="site-stage-nav"><strong>marca.</strong><span>Sobre &nbsp; Serviços &nbsp; Contato</span></div>
      <div class="site-stage-label">SUA MARCA, BEM APRESENTADA</div>
      <div class="site-stage-title">Claro.<br><em>Memorável.</em></div>
      <div class="site-stage-lines"><i></i><i></i><i></i></div>
      <div class="site-stage-button">Conheça nosso trabalho &nbsp; ↗</div>
      <div class="site-stage-orbit"></div>
    </div>
  </div>`,
  `<div class="system-stage">
    <div class="system-stage-top"><strong>seu negócio / operação</strong><span><i></i> painel ilustrativo</span></div>
    <div class="system-stage-body">
      <div class="system-stage-side"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="system-stage-main">
        <div class="system-stage-heading"><div><small>VISÃO GERAL</small><strong>Operação conectada</strong></div><span class="system-stage-badge">Hoje</span></div>
        <div class="system-stage-kpis"><div><span>Projetos</span><strong>Prioridades</strong></div><div><span>Equipe</span><strong>Rotina</strong></div><div><span>Processos</span><strong>Status</strong></div></div>
        <div class="system-stage-content">
          <div class="system-stage-list"><span>ACOMPANHAMENTO</span><div class="system-stage-row"><i></i><b></b><small>em curso</small></div><div class="system-stage-row"><i></i><b></b><small>próximo</small></div><div class="system-stage-row"><i></i><b></b><small>revisão</small></div></div>
          <div class="system-stage-bars"><span>PULSO</span><div class="system-bars"><i></i><i></i><i></i><i></i><i></i></div></div>
        </div>
      </div>
    </div>
  </div>`,
  `<div class="automation-stage">
    <div class="automation-stage-label">FLUXO SOB MEDIDA</div>
    <h4>Etapas que conversam entre si.</h4>
    <div class="automation-route">
      <div class="automation-node"><span>01</span><strong>Entrada</strong><small>O contato ou evento inicia o fluxo.</small></div>
      <span class="automation-connector"><i></i></span>
      <div class="automation-node"><span>02</span><strong>Organização</strong><small>As regras encaminham a próxima ação.</small></div>
      <span class="automation-connector"><i></i></span>
      <div class="automation-node"><span>03</span><strong>Continuidade</strong><small>A equipe recebe o que precisa.</small></div>
    </div>
    <div class="automation-stage-note"><span>Menos repetição</span><b>Mais continuidade</b></div>
  </div>`
];

function refineSolutions() {
  const grid = document.querySelector<HTMLElement>('.service-grid');
  if (!grid || grid.classList.contains('service-showcase')) return;
  grid.classList.add('service-showcase');

  const services = [...grid.querySelectorAll<HTMLElement>('.service')];
  const variants = ['site', 'system', 'automation'];
  services.forEach((service, index) => {
    service.classList.add(`service--${variants[index] ?? 'custom'}`);

    const copy = document.createElement('div');
    copy.className = 'service-copy';
    while (service.firstChild) copy.append(service.firstChild);
    service.append(copy);

    const visual = document.createElement('div');
    visual.className = `service-visual service-visual--${variants[index] ?? 'custom'}`;
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = solutionVisuals[index] ?? '';
    service.append(visual);
  });
}

function refineCaseStudy() {
  const intro = document.querySelector<HTMLElement>('#prova .case-intro');
  const board = document.querySelector<HTMLElement>('#prova .case-board');
  if (!intro || !board || board.querySelector('.case-story-grid')) return;

  const title = intro.querySelector('h2');
  const description = intro.querySelector('p:not(.eyebrow)');
  if (title) title.innerHTML = 'Na prática,<br>do campo ao escritório.';
  if (description) description.textContent = 'Um exemplo real de como tecnologia sob medida pode acompanhar diferentes partes da mesma rotina.';

  const navProof = menu?.querySelector<HTMLAnchorElement>('a[href="#prova"]');
  if (navProof) navProof.textContent = 'Na prática';

  const label = board.querySelector('.testimonial-label');
  if (label) label.textContent = 'Aplicação real';

  const story = document.createElement('div');
  story.className = 'case-story-grid';
  story.innerHTML = `
    <div class="case-story-item"><span>Contexto</span><strong>Obra e escritório fazem parte da mesma operação.</strong><small>Informações precisam continuar úteis fora de um único ambiente.</small></div>
    <div class="case-story-item"><span>Conectamos</span><strong>Frentes de trabalho, presença, documentos e gestão.</strong><small>As soluções acompanham processos que já fazem parte da rotina da empresa.</small></div>
    <div class="case-story-item"><span>No dia a dia</span><strong>Gestão de obras, financeiro, documentos e capacitação.</strong><small>Cada frente mantém seu papel dentro de uma experiência mais organizada.</small></div>`;

  const services = board.querySelector('.testimonial-services');
  if (services) services.insertAdjacentElement('beforebegin', story);
  else board.append(story);
}

function refineProcess() {
  document.querySelector('.process-grid')?.classList.add('process-journey');
}

refineHeroPreview();
refineSolutions();
refineCaseStudy();
refineProcess();

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.remove('reveal-pending');
      entry.target.classList.add('reveal-enter');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08 });
  document.querySelectorAll('.section-heading, .service, .case-intro, .case-board, .process-step, .contact-inner').forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.classList.add('reveal-pending');
    observer.observe(el);
  });
}

const copyright = document.querySelector('.footer-bottom > span');
if (copyright) copyright.textContent = `© ${new Date().getFullYear()} ArtiSys`;
