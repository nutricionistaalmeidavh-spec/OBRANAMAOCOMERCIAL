import * as React from 'react';
import { createRoot } from 'react-dom/client';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from './ui/button';
import { TextEffect } from './motion-primitives/text-effect';
import { BorderBeam } from './magic-ui/border-beam';
import { configureUmami, trackFinanceEvent } from './umami';
import { loadOptionalEffects } from './optional-effects';
import './finance-island.css';

type Screenshot = {
  image: string;
  alt: string;
  title: string;
  description: string;
  href: string;
};

const OptionalTilt = React.lazy(() => import('./optional-tilt')); // react-parallax-tilt (P2 only)

function readCanonicalScreenshots(container: Element): Screenshot[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.finance-gallery-card')).map((item) => {
    const image = item.querySelector<HTMLImageElement>('img');
    const link = item.querySelector<HTMLAnchorElement>('figcaption a');
    return {
      image: image?.getAttribute('src') ?? '',
      alt: image?.alt ?? '',
      title: item.querySelector('figcaption strong')?.textContent?.trim() ?? '',
      description: item.querySelector('figcaption span')?.textContent?.trim() ?? '',
      href: link?.getAttribute('href') ?? '',
    };
  }).filter((item) => item.image && item.title && item.href);
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'left' ? <path d="m14 18-6-6 6-6" /> : <path d="m10 6 6 6-6 6" />}
    </svg>
  );
}

function ScreenshotFigure({ item, index, tilt }: { item: Screenshot; index: number; tilt: boolean }) {
  const reduced = useReducedMotion();
  const content = (
    <div className="finance-embla-card">
      <div className="finance-gallery-screen">
        <img src={item.image} alt={item.alt} loading={index === 0 ? 'eager' : 'lazy'}
          decoding="async" width="1440" height="900" />
        {index === 0 && !reduced ? <BorderBeam duration={7} /> : null}
      </div>
      <figcaption>
        <strong>{item.title}</strong>
        <span>{item.description}</span>
        <a href={item.href} target="_blank" rel="noopener noreferrer"
          onClick={() => trackFinanceEvent('finance_screenshot_open', item.title)}>
          Ampliar captura real
        </a>
      </figcaption>
    </div>
  );
  return (
    <motion.figure className="finance-gallery-card finance-embla-slide" role="group"
      aria-roledescription="slide" aria-label={String(index + 1) + ' de 5'}
      initial={reduced ? false : { opacity: 0.83, y: 18 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      {tilt && !reduced && index === 0
        ? <React.Suspense fallback={content}><OptionalTilt>{content}</OptionalTilt></React.Suspense>
        : content}
    </motion.figure>
  );
}

function FinanceGallery({ items, tilt }: { items: Screenshot[]; tilt: boolean }) {
  const reduce = useReducedMotion();
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    loop: false,
    dragFree: false,
    duration: reduce ? 0 : 25,
  });
  const [selected, setSelected] = React.useState(0);
  const [canPrev, setPrev] = React.useState(false);
  const [canNext, setNext] = React.useState(items.length > 1);
  const [snapCount, setSnapCount] = React.useState(items.length);
  React.useEffect(() => {
    if (!api) return;
    const update = () => {
      setSelected(api.selectedScrollSnap());
      setPrev(api.canScrollPrev());
      setNext(api.canScrollNext());
      setSnapCount(api.scrollSnapList().length);
    };
    api.on('select', update);
    api.on('reInit', update);
    update();
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
  }, [api]);

  const step = (direction: 'prev' | 'next') => {
    if (!api) return;
    direction === 'prev' ? api.scrollPrev() : api.scrollNext();
    trackFinanceEvent('finance_gallery_navigation', direction);
  };

  return (
    <div className="finance-embla-root" data-oss-stack="shadcn-magic-motion-embla">
      <div className="finance-embla-topline">
        <p className="finance-embla-heading"><TextEffect text="Telas reais. Navegação livre." /></p>
        <div className="finance-embla-controls">
          <span aria-live="polite" className="finance-embla-count">{Math.min(selected + 1, snapCount)} / {snapCount}</span>
          <Button size="icon" variant="secondary" aria-label="Tela anterior" disabled={!canPrev}
            onClick={() => step('prev')}><Chevron direction="left" /></Button>
          <Button size="icon" variant="secondary" aria-label="Próxima tela" disabled={!canNext}
            onClick={() => step('next')}><Chevron direction="right" /></Button>
        </div>
      </div>
      <div className="finance-embla-viewport" ref={viewportRef}
        role="region" aria-roledescription="carrossel" aria-label="Capturas reais ArtiSys Financeiro"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') { event.preventDefault(); step('next'); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); step('prev'); }
        }}>
        <div className="finance-embla-track">
          {items.map((item, index) => <ScreenshotFigure key={item.image} item={item} index={index} tilt={tilt} />)}
        </div>
      </div>
      <div className="finance-embla-dots" role="group" aria-label="Selecionar tela do sistema">
        {Array.from({ length: snapCount }).map((_, index) => (
          <button key={index} type="button" className={'finance-embla-dot' + (index === selected ? ' is-active' : '')}
            aria-label={'Ir para tela ' + (index + 1)} aria-current={index === selected ? 'true' : undefined}
            onClick={() => { api?.scrollTo(index); trackFinanceEvent('finance_gallery_navigation', 'dot'); }}
          />
        ))}
      </div>
    </div>
  );
}

function boot() {
  const gallery = document.getElementById('finance-react-carousel');
  const root = document.querySelector<HTMLElement>('.finance-motion-root');
  if (!gallery || !root) return;
  const items = readCanonicalScreenshots(gallery);
  if (items.length !== 5) return; // intact static fallback if media inventory is incomplete
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tilt = root.dataset.tiltEnabled === 'true'
    && window.matchMedia('(min-width: 1025px) and (pointer: fine)').matches && !reduced;
  configureUmami(); // zero outbound connections unless self-hosted URL + website ID are set
  document.querySelectorAll<HTMLAnchorElement>('[data-product-cta]').forEach((link) => {
    link.addEventListener('click', () => trackFinanceEvent('finance_checkout', link.closest('.product-hero') ? 'hero' : 'footer'));
  });
  document.querySelectorAll<HTMLAnchorElement>('a[href="#financeiro-em-acao"]').forEach((link) => {
    link.addEventListener('click', () => trackFinanceEvent('finance_gallery', 'hero_cta'));
  });
  const mounted = createRoot(gallery);
  mounted.render(<FinanceGallery items={items} tilt={tilt} />);
  loadOptionalEffects(root, reduced).catch((error: unknown) => {
    console.warn('Financeiro optional visual effect not loaded', error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
