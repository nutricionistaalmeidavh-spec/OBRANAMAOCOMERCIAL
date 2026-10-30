import { readFile, access } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const webFile=(path:string)=>readFile(new URL(path,import.meta.url),'utf8');

describe('Central Artisys owner P1 hardening',()=>{
  it('keeps only active products in the owner shell and removes retired integrations',async()=>{
    const [shell,owner,routes,readonly,admin,wrangler,parity]=await Promise.all([
      webFile('../sistema.html'),webFile('./owner.ts'),webFile('../backend/owner-companies.ts'),
      webFile('../backend/license-center-readonly-internal.ts'),webFile('../backend/license-center-admin-internal.ts'),
      webFile('../wrangler.jsonc'),webFile('../qa/admin-parity-capabilities.json'),
    ]);
    for(const source of [shell,owner,routes,readonly,admin,wrangler,parity]){
      expect(source).not.toMatch(/loja[\s_-]*online|lojaonline/i);
    }
    expect(owner).toContain('Obra na Mão');
    expect(owner).toContain('Débora Lactação');
    const config=JSON.parse(wrangler);
    expect(config.services).toEqual(expect.arrayContaining([expect.objectContaining({binding:'DEBORA_OBSERVABILITY'})]));
    expect(config.secrets.required).toContain('LICENSE_CENTER_READ_SECRET');
    expect(config.secrets.required).toContain('LICENSE_CENTER_WRITE_SECRET');
  });

  it('does not bundle the retired storefront management code',async()=>{
    for(const path of ['./owner-loja-online.ts','../backend/loja-online-admin.ts']){
      await expect(access(new URL(path,import.meta.url))).rejects.toThrow();
    }
  });

  it('P1 matrix is wired for desktop tablet and mobile',async()=>{
    const source=await webFile('../scripts/qa-p1-matrix.mjs');
    for(const viewport of ['desktop','tablet','mobile'])expect(source).toContain(`'${viewport}'`);
    expect(source).toContain("environments:['local']");
  });
});
