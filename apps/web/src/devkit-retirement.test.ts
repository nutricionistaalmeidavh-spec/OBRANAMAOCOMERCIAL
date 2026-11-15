import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
describe('DevKitTools retired from public ArtiSys',()=>{
 it('does not promote the discontinued catalogue in public pages',()=>{
  for(const path of ['../index.html','../public/sistemas/index.html','../public/guia/index.html']){
   expect(read(path)).not.toContain('href="/devkits/"');
   expect(read(path)).not.toMatch(/DevKit Tool.s|id=["']devkits["']/i);
  }
 });
 it('removes the obsolete DevKit landing from the SEO source',()=>{
  const seo=read('../seo.config.mjs');
  expect(seo).not.toContain("path: '/devkits'");
  expect(seo).not.toMatch(/DevKits para criar e operar|DevKit Tool.s para desenvolver/);
 });
 it('returns 410 from the runtime if the edge-only block is ever removed',()=>{
  const worker=read('../cloudflare/worker.ts');
  expect(worker).toContain('devkits|devkitools');
  expect(worker).toContain('410');
  expect(worker).toContain('noindex');
 });
});
