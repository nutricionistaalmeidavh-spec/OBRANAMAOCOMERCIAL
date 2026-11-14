import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, useReducedMotion } from 'motion/react';
import ParallaxTilt from 'react-parallax-tilt';
import { Button } from './ui/button';
import { MagicCard } from './ui/magic-card';
import { BentoGrid, BentoCard } from './ui/bento-grid';
import { InView } from './ui/in-view';
import './experience.css';

type PublicAnalytics = {
  __artisysCRMTrack?: (name: string, props?: Record<string, string | number>) => void;
  ARTISYS_CRM_CONFIG?: {
    features?: { desktopTilt?: boolean; desktopSmoothScroll?: boolean };
  };
};

const live = window as Window & PublicAnalytics;
const base = '/wppprospector/media/';

const screenshots = [
  {
    slug: 'kanban-real.webp',
    label: 'Pipeline de vendas',
    category: 'KANBAN',
    alt: 'Tela real de oportunidades do WppProspector com dados fictícios de QA.'
  },
  {
    slug: 'leads-real.webp',
    label: 'Gestão de leads',
    category: 'CONTATOS',
    alt: 'Tela real de contatos e leads do WppProspector com dados fictícios.'
  },
  {
    slug: 'inteligencia-real.webp',
    label: 'Motor de regras',
    category: 'CONFIGURAÇÕES',
    alt: 'Tela real da central de inteligência do WppProspector com dados fictícios.'
  }
] as const;

function useFinePointerDesktop() {
  const [canTilt, setCanTilt] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    const sync = () => setCanTilt(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return canTilt;
}

function HeroArt() {
  const reduced = useReducedMotion();
  const desktop = useFinePointerDesktop();
  const enabled = live.ARTISYS_CRM_CONFIG?.features?.desktopTilt !== false;
  const visual = (
    <picture>
      <source media="(max-width: 640px)" type="image/webp" srcSet={base + 'hero-showcase-mobile-real.webp'} />
      <img
        className="hero-art-image"
        src={base + 'hero-showcase-real.webp'}
        width={1600}
        height={950}
        fetchPriority="high"
        decoding="async"
        alt="Composição com prints reais do CRM: painel do WppProspector no notebook, kanban no celular e cards de leads e regras. Dados fictícios de QA."
      />
    </picture>
  );

  return (
    <motion.div
      className="crm-hero-motion"
      initial={reduced ? false : { opacity: 0.83, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
    >
      {desktop && enabled && !reduced
        ? <ParallaxTilt
            className="crm-hero-tilt"
            tiltMaxAngleX={2.5}
            tiltMaxAngleY={3}
            perspective={1500}
            scale={1}
            transitionSpeed={1100}
            glareEnable={false}
            gyroscope={false}
          >{visual}</ParallaxTilt>
        : visual
      }
    </motion.div>
  );
}

function ConnectionBento() {
  return (
    <BentoGrid>
      <InView className="crm-bento-area crm-bento-area--featured">
        <BentoCard featured>
          <span className="status status-core">Sem conexão obrigatória</span>
          <h3>CRM manual</h3>
          <p>Seus leads e vendas organizados, sem WhatsApp ou IA.</p>
          <img src={base + 'kanban-real.webp'} width={670} height={360} loading="lazy" decoding="async"
            alt="Pipeline real do CRM, demonstrado com dados fictícios." />
        </BentoCard>
      </InView>
      <InView className="crm-bento-area crm-bento-area--small">
        <BentoCard>
          <span className="status">QR Code</span>
          <h3>WhatsApp local</h3>
          <p>Baileys open source. Conexão não oficial e opcional.</p>
        </BentoCard>
      </InView>
      <InView className="crm-bento-area crm-bento-area--small">
        <BentoCard>
          <span className="status">Meta API</span>
          <h3>Canal oficial</h3>
          <p>Integração opcional; tarifas externas podem se aplicar.</p>
        </BentoCard>
      </InView>
    </BentoGrid>
  );
}

function ScreenshotCarousel() {
  const reduced = useReducedMotion();
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    loop: false,
    dragFree: false,
    duration: reduced ? 12 : 24
  });
  const [previous, setPrevious] = React.useState(false);
  const [next, setNext] = React.useState(false);
  const controls = document.getElementById('crm-gallery-controls');

  const sync = React.useCallback(() => {
    if (!api) return;
    setPrevious(api.canScrollPrev());
    setNext(api.canScrollNext());
  }, [api]);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      sync();
      live.__artisysCRMTrack?.('crm_gallery_slide', { slide: api.selectedScrollSnap() + 1 });
    };
    sync();
    api.on('select', onSelect);
    api.on('reInit', sync);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', sync);
    };
  }, [api, sync]);

  React.useEffect(() => {
    if (!controls) return;
    controls.classList.add('crm-react-controls');
    return () => controls.classList.remove('crm-react-controls');
  }, [controls]);

  return (
    <>
      <div className="crm-embla-viewport" ref={viewportRef} aria-label="Capturas reais das funcionalidades do CRM">
        <div className="crm-embla-container">
          {screenshots.map((screen, index) => (
            <InView className="crm-embla-slide" key={screen.slug}>
              <MagicCard className="crm-real-shot">
                <a
                  className="shot-card"
                  href={base + screen.slug}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir print real: ${screen.label}`}
                  onClick={() => live.__artisysCRMTrack?.('crm_screenshot_open', { screen: screen.category })}
                >
                  <div className="shot-image">
                    <img
                      src={base + screen.slug}
                      width={1440}
                      height={900}
                      loading="lazy"
                      decoding="async"
                      alt={screen.alt}
                    />
                  </div>
                  <div className="shot-caption">
                    <strong>{screen.label}</strong>
                    <span>{String(index + 1).padStart(2, '0')} / {screen.category}</span>
                  </div>
                </a>
              </MagicCard>
            </InView>
          ))}
        </div>
      </div>
      {controls && createPortal(
        <div className="crm-embla-controls">
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Ver captura anterior"
            onClick={() => api?.scrollPrev()}
            disabled={!previous}
          >←</Button>
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Ver próxima captura"
            onClick={() => api?.scrollNext()}
            disabled={!next}
          >→</Button>
        </div>, controls
      )}
    </>
  );
}

function mountExperience() {
  const hero = document.getElementById('crm-hero-visual');
  if (hero) createRoot(hero).render(<HeroArt />);

  const gallery = document.getElementById('galeria');
  if (gallery) {
    gallery.classList.add('crm-gallery-enhanced');
    createRoot(gallery).render(<ScreenshotCarousel />);
  }

  const connections = document.getElementById('crm-connection-bento');
  if (connections) {
    connections.classList.add('crm-bento-enhanced');
    createRoot(connections).render(<ConnectionBento />);
  }
}

async function enableDesktopSmoothScroll() {
  if (live.ARTISYS_CRM_CONFIG?.features?.desktopSmoothScroll !== true) return;
  const media = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
  if (!media.matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { default: Lenis } = await import('lenis');
  const lenis = new Lenis({ autoRaf: true, anchors: true, smoothWheel: true, syncTouch: false });
  window.addEventListener('pagehide', () => lenis.destroy(), { once: true });
}

mountExperience();
void enableDesktopSmoothScroll().catch((error) => {
  console.warn('CRM optional smooth scroll not initialized', error);
});
