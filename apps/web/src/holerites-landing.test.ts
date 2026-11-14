import {readFileSync,existsSync} from 'node:fs';
import {describe,it,expect} from 'vitest';

const root=new URL('../public/gestãoholerites/',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const css=readFileSync(new URL('style.css',root),'utf8');
const script=readFileSync(new URL('motion.js',root),'utf8');

describe('landing ArtiSys Holerites (página estática independente)',()=>{
 it('serve the exact accented product route with SEO and accessible navigation',()=>{
  expect(html).toContain('https://artisys.dev/gest%C3%A3oholerites/');
  expect(html).toContain('href="#conteudo"');
  expect(html).toContain('id="main-title"');
  expect(html).toContain('"@type":"SoftwareApplication"');
  expect(html).toContain('operatingSystem');
  expect(html).toContain('id="screen-gallery"');
  expect(html).toContain('id="gallery-prev"');
  expect(html).toContain('id="gallery-next"');
 });
 it('reuses marketing images and the actual Electron/Actions test screenshots without placeholders',()=>{
  const assets=[
   'artisys-holerites-hero.webp','artisys-holerites-recursos.webp','artisys-holerites-impressao.webp','holerite-impresso-real.webp',
   'holerites-dashboard-real.webp','holerites-calculo-real.webp','holerites-ferias-real.webp','holerites-rescisao-real.webp','holerites-historico-real.webp'
  ];
  for(const asset of assets){
   const location=new URL(`media/${asset}`,root);
   expect(existsSync(location),asset).toBe(true);
   const data=readFileSync(location);
   expect(data.length,asset).toBeGreaterThan(10000);
   expect(data.toString('ascii',0,4)).toBe('RIFF');
   expect(data.toString('ascii',8,12)).toBe('WEBP');
   expect(html).toContain(`/gest%C3%A3oholerites/media/${asset}`);
  }
  expect(html).toContain('dados fictícios');
  expect(html).toContain('QA automatizado');
  expect(html).not.toContain('Capturas ilustrativas');
 });
 it('preserves honest offline scope and commercial link without inventing prices',()=>{
  expect(html).toContain('Windows');
  expect(html).toContain('offline');
  expect(html).toContain('competências de 2026');
  expect(html).toContain('não substitui');
  expect(html).toContain('mercadolivre.com.br/pagina/artisys');
  expect(html).toContain('wa.me/5516982338805');
  expect(html).not.toContain('R$ 89,90');
  expect(html).not.toContain('eSocial integrado');
 });
 it('is responsive, keyboard-friendly, motion-sensitive and dependency-free',()=>{
  expect(css).toContain('@media(max-width:540px)');
  expect(css).toContain('prefers-reduced-motion:reduce');
  expect(css).toContain(':focus-visible');
  expect(script).toContain('scrollBy');
  expect(script).toContain('prefers-reduced-motion: reduce');
  expect(html).not.toMatch(/src="https?:\/\//);
  expect(html).not.toMatch(/<link[^>]+href="https?:\/\//);
 });
});
