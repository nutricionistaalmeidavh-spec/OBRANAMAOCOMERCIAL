import EmblaCarousel from 'embla-carousel';
import { animate, inView } from 'motion';

function normalize(text: string): string {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

const storefront = document.querySelector<HTMLElement>('[data-artisys-marketing="p2-p3"]');
if (storefront) {
  const search = document.querySelector<HTMLInputElement>('#catalog-search');
  const filterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-catalog-filter]'));
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-catalog-item]'));
  const count = document.querySelector<HTMLOutputElement>('#catalog-count');
  const empty = document.querySelector<HTMLElement>('#catalog-empty');
  let category = 'Todos';

  function filterCatalog(): void {
    const term = normalize(search?.value || '');
    let visible = 0;
    for (const card of cards) {
      const matchesCategory = category === 'Todos' || card.dataset.category === category;
      const matchesSearch = !term || normalize(card.textContent || '').includes(term);
      card.hidden = !(matchesCategory && matchesSearch);
      if (!card.hidden) visible++;
    }
    if (count) count.textContent = visible === 1 ? '1 sistema' : String(visible) + ' sistemas';
    if (empty) empty.hidden = visible !== 0;
  }

  search?.addEventListener('input', filterCatalog);
  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      category = button.dataset.value || 'Todos';
      for (const filter of filterButtons) filter.setAttribute('aria-pressed', String(filter === button));
      filterCatalog();
    });
  }

  const galleryRoot = document.querySelector<HTMLElement>('[data-embla]');
  const viewport = galleryRoot?.querySelector<HTMLElement>('[data-embla-viewport]');
  const prev = document.querySelector<HTMLButtonElement>('[data-embla-prev]');
  const next = document.querySelector<HTMLButtonElement>('[data-embla-next]');
  const progress = document.querySelector<HTMLElement>('[data-embla-progress]');
  if (galleryRoot && viewport) {
    const carousel = EmblaCarousel(viewport, { align: 'start', containScroll: 'trimSnaps', loop: false });
    const update = () => {
      const total = carousel.scrollSnapList().length;
      if (prev) prev.disabled = !carousel.canScrollPrev();
      if (next) next.disabled = !carousel.canScrollNext();
      if (progress) progress.textContent = String(carousel.selectedScrollSnap() + 1) + ' de ' + String(total);
    };
    prev?.addEventListener('click', () => carousel.scrollPrev());
    next?.addEventListener('click', () => carousel.scrollNext());
    viewport.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); carousel.scrollNext(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); carousel.scrollPrev(); }
    });
    carousel.on('select', update);
    carousel.on('reInit', update);
    update();
  }

  // Content remains visible without JS. Animation is only progressive enhancement.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    inView('[data-as-reveal]', element => {
      animate(element, { opacity: [0.55, 1], transform: ['translateY(12px)', 'translateY(0px)'] }, { duration: .52, ease: 'easeOut' });
    }, { margin: '0px 0px -7% 0px' });
  }
}
