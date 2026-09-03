import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot=resolve(import.meta.dirname,'..');
const read=(path:string)=>readFile(resolve(webRoot,path),'utf8');

describe('Block 2 access and employee premium UI contract',()=>{
  it('loads the Block 2 access enhancer on every field entry',async()=>{
    const [sistema,obra,gestao]=await Promise.all([read('sistema.html'),read('obra.html'),read('gestao.html')]);
    for(const [name,html] of [['sistema.html',sistema],['obra.html',obra],['gestao.html',gestao]] as const){
      expect(html,`${name} must load Block 2 styles`).toContain('/field-premium-access.css');
      expect(html,`${name} must load Block 2 enhancer`).toContain('/field-premium-access.js');
    }
  });

  it('recognizes every approved access and employee state',async()=>{
    const enhancer=await read('public/field-premium-access.js');
    for(const surface of ['login','claim','migration','preparing','mobile-unavailable','employee','error']){
      expect(enhancer).toContain(`'${surface}'`);
    }
    expect(enhancer).toContain('detectAccessSurface');
    expect(enhancer).toContain('enhanceAccountSheet');
  });

  it('provides differentiated premium styling instead of one generic card treatment',async()=>{
    const css=await read('public/field-premium-access.css');
    for(const selector of [
      "#content[data-access-surface='login']",
      "#content[data-access-surface='claim']",
      "#content[data-access-surface='migration']",
      "#content[data-access-surface='preparing']",
      "#content[data-access-surface='mobile-unavailable']",
      "#content[data-access-surface='employee']",
      "#content[data-access-surface='error']",
      '.premium-account-sheet{',
      '.premium-worker-task{'
    ])expect(css).toContain(selector);
  });

  it('marks Block 2 surfaces as premium in the UI route map',async()=>{
    const map=await read('UI_ROUTE_MAP.md');
    expect(map).toContain('## 6. Estados de autenticação e preparação do módulo de campo');
    expect(map).toContain('Premium Bloco 2');
    for(const label of ['Login','Primeiro acesso / claim de licença','Inicialização/migração de dados compartilhados','Obra em preparação','Canal mobile não contratado','Tela exclusiva de funcionário','Erro de carregamento']){
      expect(map).toContain(label);
    }
  });
});
