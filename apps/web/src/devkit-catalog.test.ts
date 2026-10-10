import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const raw = JSON.parse(readFileSync(new URL('../public/devkits/kits.json', import.meta.url),'utf8'));
const page = readFileSync(new URL('../public/devkits/index.html',import.meta.url),'utf8');
const script = readFileSync(new URL('../public/devkits/catalogo.js',import.meta.url),'utf8');
describe('DevKit commercial catalog',()=>{
 it('is sourced from a coherent 63-item public-safe projection',()=>{
   expect(raw.items).toHaveLength(63);
   expect(new Set(raw.items.map(x=>x.id)).size).toBe(63);
   expect(new Set(raw.items.map(x=>x.category)).size).toBe(10);
   expect(raw.items.every(x=>x.title&&x.summary&&x.category&&Number.isFinite(x.price))).toBe(true);
   expect(JSON.stringify(raw)).not.toMatch(/github\.com|MATRIZ-KITS|SHA-256|\.zip|\/mnt\/data|download direto/i);
 });
 it('keeps category filtering, search and contact functional',()=>{
   for(const token of ['kit-search','kit-sort','kit-categories','load-more','repos-tiktok','/sistema.html#portal','5516982338805'])expect(page).toContain(token);
   for(const token of ['filter','input','data-category','Intl.NumberFormat','encodeURIComponent','fetch(source','PAGE_SIZE'])expect(script).toContain(token);
   expect(page).toContain('href="https://github.com/tesseract-ocr/tesseract"');
   expect(page).toContain('Guia Open Source');
   expect(page).toContain('82 projetos de referência');
   expect(page).toContain('rel="canonical" href="https://artisys.dev/devkits/"');
   expect(page).not.toContain('https://artisys.dev/devkits/catalogo/');
   expect((page.match(/class="repo-guide-item"/g)||[])).toHaveLength(82);
   expect(page).not.toContain('Preço sugerido');
   expect(script).toContain('repo-search');
   expect(script).toContain("'/devkits/kits.json'");
   expect(page).not.toContain('github.com/nutricionistaalmeidavh-spec/DevKitTools');
  expect(page).not.toContain('Os kits liberados para venda são vinculados diretamente ao checkout protegido');
  expect(page).not.toContain('class="strip shell"');
  for(const label of ['Entrega pontual','Organizado pelo problema','Somente kits liberados para venda'])
    expect(page).not.toContain(label);
  expect(page).toContain('id="catalogo"');
  expect(page).toContain('id="result-count" class="sr-only"');
  expect(page).toContain('role="status" aria-live="polite"');
  expect(page).toContain('id="reset-filters"');
  const css=readFileSync(new URL('../public/devkits/catalogo.css',import.meta.url),'utf8');
  expect(css).not.toContain('.strip{');
  expect(css).toContain('.results #reset-filters:not([hidden])');
  expect(script).toContain('count.textContent=matching.length===items.length');
 });
 it('libera Comprar somente com oferta publicada, sem IDs privados nem preço divergente',()=>{
   expect(script).toContain("CHECKOUT_BASE + '/v1/catalog'");
   expect(script).toContain("mode:'cors',credentials:'omit',cache:'no-store'");
   expect(script).toContain("encodeURIComponent(offer.id)");
   expect(script).toContain("formatter.format(offer.priceCents/100)");
   expect(script).toContain("activeOffers.get(offerKey(item.title))");
   expect(script).toContain("purchase-pending");
   expect(page).toContain("Se não aparecerem");
   expect(script).not.toContain("sha256");
   expect(script).not.toContain("artifactName");
   expect(script).not.toContain("releases/");
   expect(page).not.toContain("Compra pelo WhatsApp");
 });


 it('mantém mockup existente no card superior, reduz estatísticas e remove ícone decorativo de todos os kits',()=>{
   const css = readFileSync(new URL('../public/devkits/catalogo.css',import.meta.url),'utf8');
   const mockup = readFileSync(new URL('../public/images/devkit-tools-profissional.avif',import.meta.url));
   expect(mockup.byteLength).toBeGreaterThan(1000);
   expect(page).toContain('class="showcase-preview"');
   expect(page).toContain('src="/images/devkit-tools-profissional.avif"');
   expect(page.indexOf('class="showcase-preview"')).toBeLessThan(page.indexOf('class="showcase-stats"'));
   expect(page).toContain('class="stat">63');
   expect(page).toContain('<strong>10</strong>');
   expect(css).toContain('.showcase-stats .stat{');
   expect(css).toContain('font-size:clamp(56px,6.5vw,74px)');
   expect(css).toContain('.showcase-stats .second-stat strong{');
   expect(css).toContain('@media(max-width:650px){.showcase-main');
   expect(script).not.toContain('card-symbol');
   expect(css).not.toContain('.card-symbol');
   expect(script).toContain("article.append(top,el('h3','',item.title)");
   expect(script).toContain('meta.append(info,action);article.append(meta)');
   expect(script).toContain("CHECKOUT_BASE+'/comprar?oferta='");
   expect(script).toContain("el('details','technical')");
 });

});