/**
 * P2 optional enhancements. Never part of the default rendering path.
 * Enabled only by explicit data attributes on the Financeiro root element.
 */
export async function loadOptionalEffects(root: HTMLElement, reduced: boolean): Promise<void> {
  if (reduced || !window.matchMedia('(min-width: 1025px) and (pointer: fine)').matches) return;

  if (root.dataset.smoothScroll === 'true') {
    const { default: Lenis } = await import('lenis');
    const lenis = new Lenis({ autoRaf: true, smoothWheel: true, lerp: 0.085 });
    window.addEventListener('pagehide', () => lenis.destroy(), { once: true });
  }

  if (root.dataset.particlesEnabled === 'true') {
    const target = document.getElementById('finance-particles');
    if (!target) return;
    const [{ tsParticles }, { loadSlim }] = await Promise.all([
      import('@tsparticles/engine'),
      import('@tsparticles/slim'),
    ]);
    await loadSlim(tsParticles);
    await tsParticles.load({
      id: 'finance-particles',
      options: {
        fullScreen: { enable: false },
        background: { color: { value: 'transparent' } },
        detectRetina: true,
        fpsLimit: 30,
        particles: {
          number: { value: 10, density: { enable: true } },
          color: { value: '#8146d6' },
          opacity: { value: { min: 0.08, max: 0.18 } },
          size: { value: { min: 1, max: 2 } },
          move: { enable: true, speed: 0.3, direction: 'none' },
        },
        interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
      },
    });
  }
}
