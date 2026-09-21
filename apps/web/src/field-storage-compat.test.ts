import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Obra360 canonical storage bridge',()=>{
  it('loads the compatibility layer before the field application entrypoint',()=>{
    const html=readFileSync('obra.html','utf8');
    const entry=readFileSync('src/obra-entry.ts','utf8');
    const compat=readFileSync('src/field-storage-compat.ts','utf8');
    expect(html).toContain('./src/obra-entry.ts');
    expect(html).not.toContain('src="./src/main.ts"');
    const compatImport=entry.indexOf("import './field-storage-compat'");
    const mainImport=entry.indexOf("import './main'");
    expect(compatImport).toBeGreaterThanOrEqual(0);
    expect(mainImport).toBeGreaterThan(compatImport);
    expect(entry).not.toContain("await import('./main')");
    expect(compat).toContain("LEGACY_FIELD_DB='fluxodre-campo-standalone'");
    expect(compat).toContain("CANONICAL_FIELD_DB='obra-na-mao-comercial'");
    expect(compat).toContain('name===LEGACY_FIELD_DB?CANONICAL_FIELD_DB:name');
  });
});
