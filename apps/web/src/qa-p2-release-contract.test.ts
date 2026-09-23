import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Central Artisys P2 release contract',()=>{
  it('exposes self-contained P2 as the final release gate',async()=>{
    const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
    expect(typeof pkg.scripts?.['qa:p2']).toBe('string');
    expect(pkg.scripts['qa:p2']).toContain('qa:prepare:core');
    expect(pkg.scripts['qa:prepare:core']).toContain('playwright@1.62.1');
    expect(pkg.scripts['qa:p2']).toContain('qa-p2-release');
    expect(pkg.scripts['qa:owner:transactional']).toContain('qa-owner-transactional');
    expect(pkg.scripts['qa:field:transactional']).toContain('qa-field-transactional');
    expect(pkg.scripts['qa:release']).toContain('qa:p2');
    expect(pkg.scripts['qa:p2']).not.toContain('qa:prepare &&');
  });

  it('aggregates native checks, commercial and Obra360 Playwright, capability coverage and read-only cross-system evidence',async()=>{
    const source=await readFile(new URL('../scripts/qa-p2-release.mjs',import.meta.url),'utf8');
    for(const token of [
      "npmCommand,['test']",
      "npmCommand,['run','build']",
      "npmCommand,['run','ux:verify']",
      "npmCommand,['run','qa:p1:security']",
      'qa-owner-transactional.mjs',
      'qa-field-transactional.mjs',
      'qa-cross-system.mjs',
      'business-capabilities.json',
      "basis:'business-capabilities'",
      'emailFirst',
      'googleAuthPreserved',
      'licenseSuspensionsPerformed',
      'remoteStateRendered',
      'licenseMutationsPerformed',
      "expectedViewports=['desktop','tablet','mobile']",
      "['desktop','mobile']",
      'qa-delivery-artifacts',
    ])expect(source).toContain(token);
    expect(source).toContain("LOJAONLINE_LICENSE_SERVICE_SECRET:''");
    expect(source).toContain("qaEngine:'playwright-1.62.1-direct'");
    expect(source).toContain("coreDependencyMode:'self-contained-open-source'");
    expect(source).not.toContain('product-report.js');
    expect(source).not.toContain('buildProductQaSummary');
    expect(source).not.toContain('qa/runtime');
  });
});
