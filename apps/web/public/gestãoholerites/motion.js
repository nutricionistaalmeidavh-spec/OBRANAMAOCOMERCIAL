'use strict';
(() => {
  const track = document.getElementById('screen-gallery');
  const prev = document.getElementById('gallery-prev');
  const next = document.getElementById('gallery-next');
  if (!track || !prev || !next) return;
  const controller = new AbortController();
  window.__holeritesFallback = {destroy: () => controller.abort()};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = () => track.querySelector('.screen-card')?.getBoundingClientRect().width + 20 || track.clientWidth;
  const update = () => {
    prev.disabled = track.scrollLeft < 10;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 10;
  };
  prev.addEventListener('click', () => track.scrollBy({left:-step(),behavior:reduceMotion?'instant':'smooth'}), {signal:controller.signal});
  next.addEventListener('click', () => track.scrollBy({left:step(),behavior:reduceMotion?'instant':'smooth'}), {signal:controller.signal});
  track.addEventListener('scroll', update, {passive:true,signal:controller.signal});
  window.addEventListener('resize', update, {passive:true,signal:controller.signal});
  update();
})();
