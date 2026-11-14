// Camada de experiência isolada para landing estática ArtiSys Holerites.
// Bibliotecas MIT empacotadas localmente no workflow, sem scripts de CDN.
import { animate, inView, stagger } from 'motion';
import EmblaCarousel from 'embla-carousel';

type Umami = { track?: (name:string, payload?:Record<string,string>)=>void };
declare global { interface Window { umami?:Umami; __holeritesFallback?:{destroy:()=>void} } }

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const viewport = document.querySelector<HTMLElement>('#screen-gallery');
const previous = document.querySelector<HTMLButtonElement>('#gallery-prev');
const next = document.querySelector<HTMLButtonElement>('#gallery-next');

if (viewport && previous && next) {
  try {
    window.__holeritesFallback?.destroy();
    const carousel = EmblaCarousel(viewport, {
      align: 'start',
      containScroll: 'trimSnaps',
      loop: false,
      dragFree: false,
      duration: reducedMotion ? 0 : 25,
      watchDrag: true
    });
    const updateButtons = () => {
      previous.disabled = !carousel.canScrollPrev();
      next.disabled = !carousel.canScrollNext();
    };
    previous.addEventListener('click', () => carousel.scrollPrev(reducedMotion));
    next.addEventListener('click', () => carousel.scrollNext(reducedMotion));
    viewport.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); carousel.scrollPrev(reducedMotion); }
      if (event.key === 'ArrowRight') { event.preventDefault(); carousel.scrollNext(reducedMotion); }
    });
    carousel.on('select', updateButtons).on('reInit', updateButtons);
    updateButtons();
    document.documentElement.classList.add('holerites-embla-ready');
  } catch (error) {
    console.warn('[Holerites] Embla não inicializado; galeria nativa preservada.', error);
  }
}

// P0 Motion: animações pontuais e progressivas; sem esconder conteúdo quando JS falha.
if (!reducedMotion) {
  const reveal = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  inView(reveal, (element) => {
    animate(element, { opacity: [0.45, 1], transform: ['translateY(22px)', 'translateY(0px)'] }, {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1]
    });
  }, { margin: '0px 0px -8% 0px' });

  const cards = document.querySelectorAll<HTMLElement>('.bento-card');
  inView('.bento-grid', () => {
    animate(cards, { opacity: [0.6, 1], transform: ['translateY(12px)', 'translateY(0px)'] }, {
      duration: 0.55,
      delay: stagger(0.07),
      ease: [0.22, 1, 0.36, 1]
    });
  });
}

// P1 Umami: integração preparada, mas auto-hospedagem é opt-in e NUNCA exigida.
// Apenas se o site configurar uma URL de script na mesma origem e website-id.
const configuredScript = document.querySelector<HTMLMetaElement>('meta[name="artisys-umami-script"]')?.content;
const configuredSiteId = document.querySelector<HTMLMetaElement>('meta[name="artisys-umami-id"]')?.content;
if (configuredScript && configuredSiteId) {
  const scriptURL = new URL(configuredScript, location.origin);
  if (scriptURL.origin === location.origin && /^\//.test(scriptURL.pathname)) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = scriptURL.pathname;
    script.dataset.websiteId = configuredSiteId;
    document.head.append(script);
  }
}

document.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me/"],a[href*="mercadolivre.com.br/"]').forEach(anchor => {
  anchor.addEventListener('click', () => {
    window.umami?.track?.('holerites_cta', {
      destination: anchor.href.includes('mercadolivre') ? 'mercado_livre' : 'contato',
      source: 'landing_holerites'
    });
  });
});
