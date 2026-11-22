import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source=(relative:string)=>readFileSync(new URL(relative,import.meta.url),'utf8');

describe('P0 video regression: mobile entry and navigation contracts',()=>{
  it('shows one stable loading state before JavaScript finishes mounting the route',()=>{
    for(const page of ['../obra.html','../gestao.html','../sistema.html']){
      const html=source(page);
      expect(html).toContain('class="field-startup"');
      expect(html).toContain('aria-live="polite"');
    }
    const style=source('../public/field-premium-v2.css');
    expect(style).toContain('body.field-booting main{visibility:visible}');
    expect(source('../public/field-premium-v2.js')).toContain(":not(.field-startup)");
  });

  it('navigates from the field and management back to the system portal, not the marketing home',()=>{
    for(const path of ['../public/field.js','../public/field-premium-v2.js','./mobile-dashboard.ts']){
      const text=source(path);
      expect(text).not.toContain('./index.html#portal');
      expect(text).toContain('./sistema.html#portal');
    }
  });

  it('keeps sufficient scroll clearance and a full-width RDO review action',()=>{
    const shell=source('../public/field-premium-v2.css');
    const rdo=source('../public/field-rdo.css');
    expect(shell).toMatch(/\.shell\{padding-bottom:calc\(132px \+ env\(safe-area-inset-bottom\)\)/);
    expect(rdo).toContain('.rdo-checklist-actions #reviewRdo');
    expect(rdo).toContain('width:100%');
  });

  it('uses the shared project state instead of standalone database data when online',()=>{
    const field=source('../public/field.js');
    expect(field).toContain('const canonical=window.multiuserContext?.projectState');
    expect(field).toContain('if(window.multiuserContext&&window.multiuserSync)');
  });
});
