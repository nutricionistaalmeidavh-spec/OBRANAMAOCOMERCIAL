import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot=resolve(import.meta.dirname,'..');
const read=(path:string)=>readFile(resolve(webRoot,path),'utf8');

describe('Block 3 university premium UI contract',()=>{
  it('assigns a premium surface identity to every university route',async()=>{
    const shell=await read('src/university-shell.ts');
    for(const surface of ['home','diagnostic','tracks','lesson','practice','development','tasks','admin']){
      expect(shell).toContain(`edu-surface-${surface}`);
    }
  });

  it('styles the full university journey with differentiated premium surfaces',async()=>{
    const css=await read('src/university-premium.css');
    for(const selector of [
      '.edu-surface-home',
      '.edu-surface-diagnostic',
      '.edu-surface-tracks',
      '.edu-surface-lesson',
      '.edu-surface-practice',
      '.edu-surface-development',
      '.edu-surface-tasks',
      '.edu-surface-admin',
      '.edu-premium-nav',
      '.edu-premium-page-head',
      '.edu-premium-empty'
    ])expect(css).toContain(selector);
  });

  it('keeps the university login in the same premium visual system',async()=>{
    const css=await read('src/university-premium.css');
    expect(css).toContain('.edu-login{');
    expect(css).toContain('.edu-login>div{');
  });

  it('marks every Block 3 university surface as premium in the UI route map',async()=>{
    const map=await read('UI_ROUTE_MAP.md');
    expect(map).toContain('Premium Bloco 3');
    for(const label of ['Início','Sondagem / Diagnóstico','Trilhas e progresso','Aula','Prática & Desafios','Desenvolvimento / evolução','Tarefas','Tutor / Admin'])expect(map).toContain(label);
  });
});
