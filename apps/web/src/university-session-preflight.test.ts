import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../universidade.html', import.meta.url), 'utf8');

describe('Retired university entry', () => {
  it('redirects to the operational portal without loading educational UI', () => {
    expect(html).toContain("./sistema.html#portal");
    expect(html).not.toContain('manifest-universidade');
    expect(html).not.toContain("import('./src/main.ts')");
  });
});
