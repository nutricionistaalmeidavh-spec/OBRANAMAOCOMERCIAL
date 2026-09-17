import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const ownerSource=()=>readFile(new URL('./owner-loja-online.ts',import.meta.url),'utf8');
const shellSource=()=>readFile(new URL('../sistema.html',import.meta.url),'utf8');
const adapterSource=()=>readFile(new URL('../backend/loja-online-admin.ts',import.meta.url),'utf8');

describe('Central Artisys owner P1 hardening',()=>{
  it('keeps the Loja Online licensing secret server-side',async()=>{
    const [owner,shell,adapter]=await Promise.all([ownerSource(),shellSource(),adapterSource()]);
    expect(owner).not.toContain('LOJAONLINE_LICENSE_SERVICE_SECRET');
    expect(shell).not.toContain('LOJAONLINE_LICENSE_SERVICE_SECRET');
    expect(adapter).toContain('LOJAONLINE_LICENSE_SERVICE_SECRET');
    expect(adapter).toContain('x-artisys-license-secret');
  });

  it('keeps Loja Online calls behind owner API routes',async()=>{
    const owner=await ownerSource();
    expect(owner).toContain('/api/owner/loja-online/overview');
    expect(owner).toContain('/api/owner/loja-online/companies');
    expect(owner).not.toContain('/api/internal/artisys/loja-online');
  });

  it('preserves explicit confirmations for destructive license operations',async()=>{
    const owner=await ownerSource();
    expect(owner).toMatch(/confirm\(/);
    expect(owner).toContain('Bloquear');
    expect(owner).toContain('Desbloquear');
  });

  it('P1 matrix is wired for desktop tablet and mobile',async()=>{
    const source=await readFile(new URL('../scripts/qa-p1-matrix.mjs',import.meta.url),'utf8');
    for(const viewport of ['desktop','tablet','mobile'])expect(source).toContain(`'${viewport}'`);
    expect(source).toContain("environments:['local']");
  });
});
