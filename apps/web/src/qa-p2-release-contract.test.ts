import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Central Artisys P2 release contract',()=>{
  it('exposes P2 as the final release gate',async()=>{
    const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
    expect(typeof pkg.scripts?.['qa:p2']).toBe('string');
    expect(pkg.scripts['qa:p2']).toContain('qa:prepare');
    expect(pkg.scripts['qa:p2']).toContain('qa-p2-release');
    expect(pkg.scripts['qa:release']).toContain('qa:p2');
  });

  it('aggregates native, P1 and read-only cross-system evidence',async()=>{
    const source=await readFile(new URL('../scripts/qa-p2-release.mjs',import.meta.url),'utf8');
    for(const token of ['npmCommand,[\'test\']','build','ux:verify','qa:p1:security','qa-p1-sweep','qa-p1-matrix','qa-cross-system','buildProductQaSummary','writeProductQaBundle']){
      expect(source).toContain(token);
    }
    expect(source).toContain("LOJAONLINE_LICENSE_SERVICE_SECRET:''");
    expect(source).toContain('qa-delivery-artifacts');
  });
});
