import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot=resolve(import.meta.dirname,'..');
const read=(path:string)=>readFile(resolve(webRoot,path),'utf8');

describe('mobile premium UI contract',()=>{
  it('styles every management component emitted by the dashboard renderer',async()=>{
    const [base,premium,dashboard]=await Promise.all([read('public/field.css'),read('public/field-premium-v2.css'),read('src/mobile-dashboard.ts')]);
    const css=base+'\n'+premium;
    for(const className of ['management-kpis','management-kpi','management-summary-card','management-summary-icon','management-details']){
      expect(dashboard).toContain(className);
      expect(css,`missing base CSS for .${className}`).toMatch(new RegExp(`\\.${className}\\{[^}]+`));
    }
  });

  it('keeps the legacy field shell hidden until the application is ready on every app entry',async()=>{
    const [css,enhancer,sistema,obra,gestao]=await Promise.all([read('public/field-premium-v2.css'),read('public/field-premium-v2.js'),read('sistema.html'),read('obra.html'),read('gestao.html')]);
    for(const [name,html] of [['sistema.html',sistema],['obra.html',obra],['gestao.html',gestao]] as const){
      expect(html,`${name} must start in boot state`).toMatch(/<body[^>]*class=["'][^"']*field-booting/);
      expect(html,`${name} must load the premium enhancer`).toContain('/field-premium-v2.js');
    }
    expect(css).toContain('body.field-booting .top');
    expect(css).toContain('body.field-booting main');
    expect(css).toContain('body.field-booting .nav');
    expect(enhancer).toContain("classList.remove('field-booting')");
  });

  it('applies the premium visual shell to all four primary field tabs',async()=>{
    const [field,enhancer]=await Promise.all([read('public/field.js'),read('public/field-premium-v2.js')]);
    expect(field).toMatch(/function renderDay\([^)]*\)[\s\S]*?day-hero/);
    expect(enhancer).toContain("active==='obra360'");
    expect(enhancer).toContain("'obra360-hero'");
    expect(enhancer).toContain("active==='team'");
    expect(enhancer).toContain("'team-hero'");
    expect(field).toMatch(/function renderManagement\([^)]*\)[\s\S]*?management-hero/);
  });

  it('keeps Dias focused on immediate work and moves secondary navigation into Obra360',async()=>{
    const [field,enhancer,css]=await Promise.all([read('public/field.js'),read('public/field-premium-v2.js'),read('public/field-premium-v2.css')]);
    const day=field.match(/function renderDay\(\)\{[\s\S]*?function planCard/)?.[0]??'';

    expect(day).toContain('data-screen="issues"');
    expect(day).toContain('Próximas ações');
    expect(enhancer).toContain("active==='today'");
    expect(enhancer).toContain("[data-screen=\"more\"],[data-screen=\"settings\"]");
    expect(enhancer).toContain("dayButton.dataset.screen='settings'");
    expect(enhancer).toContain("title.textContent='Configurações'");
    expect(enhancer).toContain("meta.textContent='Checklists e horários'");
    expect(css).toContain('.day-focus-actions{grid-template-columns:1fr');
  });

  it('covers Block 1 internal Obra360 screens and their modal surfaces with the premium shell',async()=>{
    const [enhancer,css,map]=await Promise.all([read('public/field-premium-v2.js'),read('public/field-premium-v2.css'),read('UI_ROUTE_MAP.md')]);

    expect(enhancer).toContain('detectInternalSurface');
    for(const surface of ['floors','floor-detail','issues','planning','settings'])expect(enhancer).toContain(`'${surface}'`);
    expect(enhancer).toContain('enhanceInternalSurface');
    expect(enhancer).toContain('enhanceSheet');
    expect(enhancer).toContain("document.addEventListener('field:sheet-rendered',enhanceSheet)");
    expect(enhancer).not.toContain('MutationObserver');

    for(const selector of [
      '.internal-hero{',
      "#content[data-surface='floors']",
      "#content[data-surface='floor-detail']",
      "#content[data-surface='issues']",
      "#content[data-surface='planning']",
      "#content[data-surface='settings']",
      '.premium-sheet .sheet-head{'
    ])expect(css).toContain(selector);

    for(const screen of ['Pavimentos','Detalhe de pavimento','Pendências','Planejamento / produtividade','Configurações']){
      const row=map.split('\n').find(line=>line.includes(`| ${screen} |`))??'';
      expect(row,`${screen} must be marked premium in the route map`).toMatch(/Premium/);
    }
  });
});
