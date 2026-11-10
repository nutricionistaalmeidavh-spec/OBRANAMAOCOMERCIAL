/* ArtiSys /links — progressive motions via native Web Animations API, no CDN or dependency. */
(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches || typeof Element.prototype.animate !== "function") return;

  const hero = document.querySelector(".intro");
  const orb = hero?.querySelector(".hero-art");
  const academy = document.querySelector('[data-link-id="academy"]');
  const socialLinks = [...document.querySelectorAll(".social-nav a")];
  const activeAnimations = [];
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

  function reveal(selector, delay, duration = 780, distance = 16) {
    const node = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!node) return;
    activeAnimations.push(node.animate(
      [
        { opacity: 0, transform: "translate3d(0," + distance + "px,0) scale(0.988)" },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ],
      { duration, delay, easing, fill: "backwards" }
    ));
  }

  // One-shot cinematic entrance. Content stays visible if JS is unavailable.
  reveal(".topbar", 0, 520, 8);
  reveal(hero, 85, 900, 22);
  reveal(".hero-copy", 230, 730, 14);
  reveal(orb, 350, 1100, 28);
  // O diagnóstico é a primeira ação; a Academy aparece logo depois.
  reveal(".diagnostic-callout", 505, 810, 18);
  reveal(academy, 625, 810, 18);
  socialLinks.forEach((link, index) => reveal(link, 805 + index * 85, 570, 12));
  reveal(".footer", 850, 600, 10);

  // Fine-pointer parallax only: touch devices get the opening motion, never a heavy loop.
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");
  let frame = 0;
  function restoreOrb() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (orb) orb.style.transform = "";
  }
  if (hero && orb && finePointer.matches) {
    hero.addEventListener("pointermove", (event) => {
      if (reduceMotion.matches || frame) return;
      const bounds = hero.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
      const y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      frame = window.requestAnimationFrame(() => {
        orb.style.transform = "translate3d(" + Math.round(x * 9) + "px," + Math.round(y * 7) + "px,0)";
        frame = 0;
      });
    }, { passive: true });
    hero.addEventListener("pointerleave", restoreOrb);
  }

  // Reduced-motion changes apply immediately, including during an entrance.
  reduceMotion.addEventListener("change", (event) => {
    if (!event.matches) return;
    activeAnimations.forEach((animation) => animation.cancel());
    restoreOrb();
  });
  window.addEventListener("pagehide", restoreOrb, { once: true });
})();