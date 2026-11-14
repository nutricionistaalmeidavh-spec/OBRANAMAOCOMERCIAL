/* Progressive-enhancement motion, using only open browser APIs (no paid runtime). */
(() => {
  'use strict';

  const track = document.getElementById('galeria');
  const prev = document.getElementById('galeria-anterior');
  const next = document.getElementById('galeria-proxima');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (track && prev && next) {
    const cards = [...track.querySelectorAll('.shot-card')];
    const distance = () => {
      const card = cards[0];
      if (!card) return 0;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    };
    const scrollOne = (direction) => {
      track.scrollBy({
        left: direction * distance(),
        behavior: reduceMotion ? 'instant' : 'smooth'
      });
    };
    prev.addEventListener('click', () => scrollOne(-1));
    next.addEventListener('click', () => scrollOne(1));

    let frame = 0;
    const updateArrows = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const limit = Math.max(0, track.scrollWidth - track.clientWidth);
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= limit - 2;
      });
    };
    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows, { passive: true });
    updateArrows();
  }

  // Enter with a single integrated image made from authentic CRM QA screens.
  // Ambient illumination is CSS-only; this one-time reveal is GPU friendly.
  const stage = document.querySelector('[data-hero-stage]');
  if (stage && !reduceMotion && 'IntersectionObserver' in window && Element.prototype.animate) {
    const image = stage.querySelector('.hero-art-image');
    if (image) {
      const observeStage = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observeStage.unobserve(entry.target);
          image.animate([
            { opacity: .52, transform: 'translate3d(0, 25px, 0) scale(.96)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
          ], { duration: 1150, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
        }
      }, { threshold: .13 });
      observeStage.observe(stage);
    }
  }

  if (reduceMotion || !('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const revealElements = [...document.querySelectorAll('[data-reveal]')];
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal.unobserve(entry.target);
      entry.target.animate([
        { opacity: 0, transform: 'translate3d(0, 34px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
      ], {
        duration: 960,
        easing: 'cubic-bezier(.22, 1, .36, 1)',
        fill: 'both'
      });
    }
  }, { threshold: .11, rootMargin: '0px 0px -24px 0px' });

  revealElements.forEach((element) => reveal.observe(element));

  if (track) {
    const shots = [...track.querySelectorAll('.shot-card')];
    const shotReveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        shotReveal.unobserve(entry.target);
        entry.target.animate([
          { opacity: .35, transform: 'translate3d(0, 18px, 0) scale(.95)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
        ], {
          duration: 1150,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          fill: 'both'
        });
      }
    }, { root: track, threshold: .12 });
    shots.forEach((shot) => shotReveal.observe(shot));
  }
})();
