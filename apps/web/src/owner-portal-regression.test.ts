import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot=resolve(import.meta.dirname,'..');
const read=(path:string)=>readFile(resolve(webRoot,path),'utf8');

describe('owner portal boot and reserved tenant access',()=>{
  it('keeps the owner route accessible and renders an explicit portal loading state instead of the legacy shell',async()=>{
    const [enhancer,html,style]=await Promise.all([
      read('public/field-premium-access.js'),
      read('sistema.html'),
      read('public/field-premium-v2.css')
    ]);
    expect(enhancer).toContain("if(location.hash==='#owner')document.body.classList.remove('field-booting')");
    expect(html).toContain('class="field-startup"');
    expect(style).toContain('body.field-booting main{visibility:visible}');
  });

  it('does not use the document shell as fallback for failed JS requests',async()=>{
    const sw=await read('public/sw.js');
    expect(sw).toContain('if(r.ok)');
    expect(sw).toContain("e.request.mode==='navigate'");
    expect(sw).toContain("new Response('',{status:503})");
  });

  it('keeps the reserved lifetime entitlement tenant-scoped and out of global superadmin data',async()=>{
    const [migration,worker]=await Promise.all([read('cloudflare/migrations/0007_reserved_lifetime_license.sql'),read('cloudflare/worker.ts')]);
    expect(migration).toContain("'plan','lifetime-manual'");
    expect(migration).toContain("'status','active'");
    expect(migration).toContain("json_array('desktop','mobile')");
    expect(migration).not.toContain('@hotmail.com');
    expect(migration).not.toContain('platform_accesses');
    expect(migration).not.toContain("'companies'");
    expect(worker).toContain('ensureReservedLifetimeLicense');
    expect(worker).toContain("plan:'lifetime-manual'");
    expect(worker).toContain("channels:['desktop','mobile']");
    expect(worker).not.toContain('@hotmail.com');
  });
});
