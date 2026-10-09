import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const raw = JSON.parse(readFileSync(new URL('../public/devkits/catalogo/kits.json', import.meta.url),'utf8'));
const page = readFileSync(new URL('../public/devkits/catalogo/index.html',import.meta.url),'utf8');
const script = readFileSync(new URL('../public/devkits/catalogo/catalogo.js',import.meta.url),'utf8');
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
   expect((page.match(/class="repo-guide-item"/g)||[])).toHaveLength(82);
   expect(page).not.toContain('Preço sugerido');
   expect(script).toContain('repo-search');
   expect(page).not.toContain('github.com/nutricionistaalmeidavh-spec/DevKitTools');
 });
});