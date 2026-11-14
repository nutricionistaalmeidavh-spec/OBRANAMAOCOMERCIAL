/**
 * ArtiSys Financeiro progressive motion enhancement.
 * Core: open-browser Web Animations and IntersectionObserver.
 * No remote requests, runtime subscriptions, scroll listeners or re-renders.
 * Supports optional GSAP + ScrollTrigger supplied explicitly by a host.
 */
(() => {
  'use strict';
  const root = document.querySelector('.finance-motion-root');
  if (!root || typeof window.matchMedia !== 'function') return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animated = new WeakSet();
  const cubic = 'cubic-bezier(0.22, 1, 0.36, 1)';
  let observer;

  function reveal(element, delay = 0, distance = 24) {
    if (!element || animated.has(element) || preference.matches) return;
    animated.add(element);
    if (typeof element.animate !== 'function') return;
    element.animate(
      [
        { transform: 'translate3d(0, ' + distance + 'px, 0)', opacity: 0.72 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
      ],
      { duration: 840, delay, easing: cubic, fill: 'both' }
    );
  }

  function intro() {
    reveal(root.querySelector('.finance-hero-copy h1'), 40, 28);
    reveal(root.querySelector('.finance-hero-copy .hero-summary'), 155, 24);
    reveal(root.querySelector('.finance-hero-copy .hero-actions'), 260, 18);
    const mainShot = root.querySelector('.finance-hero-screenshot');
    const insetShot = root.querySelector('.finance-hero-screenshot-secondary');
    if (mainShot && typeof mainShot.animate === 'function') {
      mainShot.animate(
        [
          { transform: 'translate3d(24px, 22px, 0) rotate(4deg)', opacity: 0.68 },
          { transform: 'translate3d(0, 0, 0) rotate(1.8deg)', opacity: 1 }
        ],
        { duration: 1160, delay: 120, easing: cubic, fill: 'both' }
      );
    }
    if (insetShot && typeof insetShot.animate === 'function') {
      insetShot.animate(
        [
          { transform: 'translate3d(-22px, 28px, 0) rotate(-10deg)', opacity: 0 },
          { transform: 'translate3d(0, 0, 0) rotate(-6deg)', opacity: 1 }
        ],
        { duration: 1050, delay: 350, easing: cubic, fill: 'both' }
      );
    }
  }

  function setupNativeScrollMotion() {
    if (!('IntersectionObserver' in window)) return;
    const targets = root.querySelectorAll(
      '.finance-section-heading, .finance-feature, .finance-gallery-card, .finance-conversion, .product-details .content-section, .product-cta'
    );
    observer = new IntersectionObserver(
      (entries, self) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target;
          const isCard = element.matches('.finance-feature, .finance-gallery-card');
          const siblings = isCard ? Array.from(element.parentElement.children) : [];
          const order = isCard ? siblings.indexOf(element) : 0;
          reveal(element, Math.min(order, 3) * 100, isCard ? 35 : 24);
          self.unobserve(element);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -28px 0px' }
    );
    targets.forEach((element) => observer.observe(element));
  }

  function setupOptionalGsap() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger || typeof gsap.registerPlugin !== 'function') return;
    gsap.registerPlugin(ScrollTrigger);
    const desktop = window.matchMedia('(min-width: 1025px)');
    const gallery = root.querySelector('.finance-gallery');
    const images = root.querySelectorAll('.finance-gallery-screen img');
    images.forEach((image) => {
      gsap.fromTo(image, { scale: 0.93 }, {
        scale: 1.02, ease: 'none',
        scrollTrigger: {
          trigger: image.closest('.finance-gallery-card'),
          start: 'top bottom', end: 'bottom top', scrub: true
        }
      });
    });
    if (desktop.matches && gallery) {
      const heading = gallery.querySelector('.finance-gallery-heading');
      gsap.to(heading, {
        opacity: 0.82, ease: 'none',
        scrollTrigger: {
          trigger: gallery, start: 'top 95px', end: 'bottom 70%', scrub: true
        }
      });
    }
  }

  function init() {
    if (preference.matches) return;
    intro();
    setupNativeScrollMotion();
    setupOptionalGsap();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  function stopIfReduced() {
    if (!preference.matches) return;
    observer?.disconnect();
    root.querySelectorAll('*').forEach((node) => {
      if (typeof node.getAnimations === 'function') {
        node.getAnimations().forEach((animation) => animation.cancel());
      }
    });
  }
  if (typeof preference.addEventListener === 'function') {
    preference.addEventListener('change', stopIfReduced);
  }
})();
