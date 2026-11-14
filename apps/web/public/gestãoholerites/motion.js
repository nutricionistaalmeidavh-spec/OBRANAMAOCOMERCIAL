'use strict';
(() => {
  const track = document.getElementById('screen-gallery');
  const prev = document.getElementById('gallery-prev');
  const next = document.getElementById('gallery-next');
  if (!track || !prev || !next) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = () => track.querySelector('.screen-card')?.getBoundingClientRect().width + 20 || track.clientWidth;
  const update = () => {
    prev.disabled = track.scrollLeft < 10;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 10;
  };
  prev.addEventListener('click', () => track.scrollBy({left:-step(),behavior:reduceMotion?'instant':'smooth'}));
  next.addEventListener('click', () => track.scrollBy({left:step(),behavior:reduceMotion?'instant':'smooth'}));
  track.addEventListener('scroll', update, {passive:true});
  window.addEventListener('resize', update, {passive:true});
  update();
})();
