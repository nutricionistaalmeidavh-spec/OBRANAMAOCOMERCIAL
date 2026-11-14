/* ArtiSys Oficina: motion progressivo + galeria sem dependência externa.
 * Facilita substituição por Motion/Embla quando o frontend público migrar para React.
 * A página continua funcional com JavaScript desativado. */
(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = document.getElementById('galeria');
  const previous = document.getElementById('galeria-anterior');
  const next = document.getElementById('galeria-proxima');
  const count = document.getElementById('gallery-count');

  if (track && previous && next) {
    const cards = [...track.querySelectorAll('.gallery-card')];
    const scrollDistance = () => {
      const card = cards[0];
      if (!card) return 0;
      return card.getBoundingClientRect().width +
        (parseFloat(getComputedStyle(track).columnGap) || 0);
    };
    const scrollOne = (dir) => track.scrollBy({
      left: dir * scrollDistance(),
      behavior: reduceMotion ? 'instant' : 'smooth'
    });
    previous.addEventListener('click', () => scrollOne(-1));
    next.addEventListener('click', () => scrollOne(1));

    let raf = 0;
    const updateControls = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const limit = Math.max(0, track.scrollWidth - track.clientWidth);
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= limit - 2;
        const distance = scrollDistance();
        const current = distance ? Math.round(track.scrollLeft / distance) + 1 : 1;
        if (count) count.textContent = String(Math.min(cards.length, Math.max(1, current))).padStart(2, '0') +
          ' / ' + String(cards.length).padStart(2, '0');
      });
    };
    track.addEventListener('scroll', updateControls, { passive: true });
    window.addEventListener('resize', updateControls, { passive: true });
    track.addEventListener('keydown', (event) => {
      if (event.target !== track) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); scrollOne(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); scrollOne(1); }
    });
    updateControls();
  }

  if (!reduceMotion && 'IntersectionObserver' in window && Element.prototype.animate) {
    const observed = [...document.querySelectorAll('[data-reveal]')];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        entry.target.animate([
          { opacity: 0, transform: 'translate3d(0, 22px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ], { duration: 740, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
      }
    }, { threshold: .08, rootMargin: '0px 0px -18px 0px' });
    observed.forEach((item) => observer.observe(item));

    const stage = document.querySelector('.hero-visual');
    if (stage) {
      const entrance = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entrance.unobserve(stage);
          for (const [name, delay] of [['desktop', 0], ['order', 220], ['mobile', 350]]) {
            const layer = stage.querySelector('[data-stage-layer="' + name + '"]');
            if (!layer) continue;
            layer.animate([
              { opacity: 0, translate: '0 26px', scale: '.965' },
              { opacity: 1, translate: '0 0', scale: '1' }
            ], { duration: 950, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
          }
        }
      }, { threshold: .12 });
      entrance.observe(stage);
    }
  }

  // Umami opcional: conectar a instância self-hosted do projeto por configuração
  // explícita. Nenhum serviço externo é carregado ou acionado sem consentimento.
  const consentBox = document.querySelector('.consent');
  const allow = document.getElementById('analytics-allow');
  const deny = document.getElementById('analytics-deny');
  const key = 'artisys-oficina-analytics';
  let permission = 'pending';
  try { permission = window.localStorage.getItem(key) || 'pending'; } catch {}
  document.body.dataset.analyticsConsent = permission;
  if (consentBox && permission !== 'pending') consentBox.dataset.hidden = 'true';

  const choose = (value) => {
    permission = value;
    document.body.dataset.analyticsConsent = value;
    try { window.localStorage.setItem(key, value); } catch {}
    if (consentBox) consentBox.dataset.hidden = 'true';
  };
  if (allow) allow.addEventListener('click', () => choose('allowed'));
  if (deny) deny.addEventListener('click', () => choose('denied'));

  for (const link of document.querySelectorAll('[data-event]')) {
    link.addEventListener('click', () => {
      if (permission !== 'allowed') return;
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(link.dataset.event, { product: 'oficina', page: '/oficina/' });
      }
    });
  }
})();