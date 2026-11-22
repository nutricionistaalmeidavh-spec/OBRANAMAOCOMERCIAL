import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

describe('video 2026-11-22 P0 mobile delivery contracts',()=>{
  it('shows an accessible loading state before auth and bundle initialization on all entry pages',()=>{
    for(const file of ['../obra.html','../gestao.html','../sistema.html']){
      const html=read(file);
      expect(html).toContain('class="field-booting"');
      expect(html).toContain('class="field-loading" role="status" aria-live="polite"');
      expect(html).toContain('/field-premium-v2.css?v=20261122-mobile-p0-1');
    }
    const css=read('../public/field-premium-v2.css');
    expect(css).toContain('body.field-booting .field-loading');
  });

  it('preserves safe-area space for the bottom navigation and RDO actions',()=>{
    const css=read('../public/field-premium-v2.css');
    const rdo=read('../public/field-rdo.css');
    expect(css).toContain('body.field-shell-active #content{padding-bottom:calc(132px + env(safe-area-inset-bottom))}');
    expect(css).toContain('bottom:calc(6px + env(safe-area-inset-bottom))');
    expect(rdo).toContain('.rdo-step-body strong,.rdo-step-body .meta');
    expect(rdo).toContain('.rdo-checklist-actions{padding-bottom:calc(12px + env(safe-area-inset-bottom))}');
  });

  it('renders Dias before waiting for secondary data and refreshes without disrupting editing',()=>{
    const main=read('./main.ts');
    const field=read('../public/field.js');
    const importAt=main.indexOf('const fieldReady=import(');
    const secondaryAt=main.indexOf('refreshWhenReady(window.multiuserRefreshReceipts?.())');
    const waitAt=main.indexOf('await fieldReady;',importAt);
    expect(importAt).toBeGreaterThan(0);
    expect(secondaryAt).toBeGreaterThan(importAt);
    expect(waitAt).toBeGreaterThan(secondaryAt);
    expect(field).toContain("document.addEventListener('field:reference-updated'");
    expect(field).toContain("if(!state||sheet?.open)return");
  });

  it('returns directly to the authenticated portal without the marketing-page redirect',()=>{
    for(const page of ['./mobile-dashboard.ts','../public/field.js','../public/field-premium-v2.js','./owner.ts','./university-shell.ts']){
      const content=read(page);
      expect(content).not.toContain('./index.html#portal');
      expect(content).toContain('./sistema.html#portal');
    }
    for(const page of ['../obra.html','../gestao.html','../sistema.html']){
      expect(read(page)).toContain('/field-premium-v2.js?v=20261122-mobile-p0-1');
    }
  });

  it('installs the updated runtime and field assets for PWA clients',()=>{
    const sw=read('../public/sw.js');
    expect(sw).toContain('obra-na-mao-comercial-v27-mobile-p0');
    expect(sw).toContain('field.js?v=20261122-mobile-p0-1');
    expect(read('../obra.html')).toContain('rel="modulepreload" href="/field.js?v=20261122-mobile-p0-1"');
  });
});
