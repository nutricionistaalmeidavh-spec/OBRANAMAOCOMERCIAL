import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Central Artisys P1 automatic sweeps',()=>{
  it('wires UI and API sweeps into P1',async()=>{
    const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
    expect(typeof pkg.scripts?.['qa:p1:sweep']).toBe('string');
    expect(pkg.scripts['qa:p1']).toContain('qa:p1:sweep');
    expect(pkg.scripts['qa:release']).toContain('qa:p1');

    const source=await readFile(new URL('../scripts/qa-p1-sweep.mjs',import.meta.url),'utf8');
    expect(source).toContain('runUiSweep');
    expect(source).toContain('runApiSweep');
    expect(source).toContain("preserveHashRoutes:true");
    expect(source).toContain('/sistema#owner');
    expect(source).toContain('owner-overview-protected');
    expect(source).toContain('owner-companies-protected');
    expect(source).toContain('owner-audit-protected');
  });

  it('keeps the automatic API sweep read-only and unauthenticated',async()=>{
    const source=await readFile(new URL('../scripts/qa-p1-sweep.mjs',import.meta.url),'utf8');
    expect(source).not.toContain('LOJAONLINE_LICENSE_SERVICE_SECRET');
    expect(source).not.toMatch(/method:\s*['"]POST['"]/);
    expect(source).not.toMatch(/method:\s*['"]PUT['"]/);
    expect(source).not.toMatch(/method:\s*['"]DELETE['"]/);
  });
});
