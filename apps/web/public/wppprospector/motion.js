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

  // Choreograph genuine laptop/phone screenshots. Native Web Animations API:
  // self-hosted, no CDN, no commercial GSAP runtime or external service.
  const stage = document.querySelector('[data-hero-stage]');
  if (stage && !reduceMotion && 'IntersectionObserver' in window && Element.prototype.animate) {
    const layers = [
      ['laptop', 0, 'translate3d(0, 38px, 0) scale(.94)'],
      ['phone', 210, 'translate3d(24px, 34px, 0) scale(.87)'],
      ['leads', 310, 'translate3d(-20px, 18px, 0) scale(.88)'],
      ['rules', 430, 'translate3d(22px, 18px, 0) scale(.88)'],
      ['pipeline', 520, 'translate3d(-16px, 25px, 0) scale(.9)']
    ];
    const stageReveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        stageReveal.unobserve(entry.target);
        const orbit = stage.querySelector('.stage-orbit');
        if (orbit) {
          orbit.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 1450, delay: 190, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both'
          });
        }
        for (const [name, delay, from] of layers) {
          const element = stage.querySelector('[data-stage-layer="' + name + '"]');
          if (!element || getComputedStyle(element).display === 'none') continue;
          const resting = getComputedStyle(element).transform;
          element.animate([
            { opacity: 0, transform: from },
            { opacity: 1, transform: resting === 'none' ? 'none' : resting }
          ], {
            duration: 1030,
            delay,
            easing: 'cubic-bezier(.22,1,.36,1)',
            fill: 'both'
          });
        }
      }
    }, { threshold: .08 });
    stageReveal.observe(stage);
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
