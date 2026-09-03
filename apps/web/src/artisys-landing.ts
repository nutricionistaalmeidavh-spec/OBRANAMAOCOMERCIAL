import './artisys-landing.css';

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
