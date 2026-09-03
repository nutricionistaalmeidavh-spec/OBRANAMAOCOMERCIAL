import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot=resolve(import.meta.dirname,'..');
const read=(path:string)=>readFile(resolve(webRoot,path),'utf8');

describe('mobile premium UI contract',()=>{
  it('styles every management component emitted by the dashboard renderer',async()=>{
    const [css,dashboard]=await Promise.all([read('public/field.css'),read('src/mobile-dashboard.ts')]);
    for(const className of ['management-kpis','management-kpi','management-summary-card','management-summary-icon','management-details']){
      expect(dashboard).toContain(className);
      expect(css,`missing base CSS for .${className}`).toMatch(new RegExp(`\\.${className}\\{[^}]+`));
    }
  });

  it('keeps the legacy field shell hidden until the authenticated app is ready',async()=>{
    const [css,obra,gestao]=await Promise.all([read('public/field.css'),read('obra.html'),read('gestao.html')]);
    for(const [name,html] of [['obra.html',obra],['gestao.html',gestao]] as const){
      expect(html,`${name} must start in boot state`).toMatch(/<body[^>]*class=["'][^"']*field-booting/);
    }
    expect(css).toContain('body.field-booting .top');
    expect(css).toContain('body.field-booting main');
    expect(css).toContain('body.field-booting .nav');
  });

  it('applies the premium visual shell to all four primary field tabs',async()=>{
    const field=await read('public/field.js');
    expect(field).toMatch(/function renderDay\([^)]*\)[\s\S]*?day-hero/);
    expect(field).toMatch(/function renderObra360\([^)]*\)[\s\S]*?obra360-hero/);
    expect(field).toMatch(/function renderTeam\([^)]*\)[\s\S]*?team-hero/);
    expect(field).toMatch(/function renderManagement\([^)]*\)[\s\S]*?management-hero/);
  });
});
