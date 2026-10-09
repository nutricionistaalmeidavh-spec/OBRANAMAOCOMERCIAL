import { describe, it, expect } from 'vitest';
import { handleDevkitLegacyRedirect } from './devkit-canonical-redirect';

describe('retired DevKit catalog permanent redirect', () => {
  it.each(['/devkits/catalogo','/devkits/catalogo/','/devkits/catalogo/index.html'])('301 %s to the canonical catalog', path => {
    const response = handleDevkitLegacyRedirect(new Request('https://artisys.dev' + path));
    expect(response?.status).toBe(301);
    expect(response?.headers.get('location')).toBe('https://artisys.dev/devkits/');
  });
  it('preserves query strings and old static asset URLs', () => {
    const page = handleDevkitLegacyRedirect(new Request('https://artisys.dev/devkits/catalogo/?utm_source=tiktok'));
    expect(page?.headers.get('location')).toBe('https://artisys.dev/devkits/?utm_source=tiktok');
    const asset = handleDevkitLegacyRedirect(new Request('https://artisys.dev/devkits/catalogo/kits.json?v=1'));
    expect(asset?.headers.get('location')).toBe('https://artisys.dev/devkits/kits.json?v=1');
  });
  it('does not intercept unrelated application routes or write requests', () => {
    for (const path of ['/devkits/', '/sistema.html', '/sistemas/', '/api/bootstrap', '/devkits/catalogoe']) {
      expect(handleDevkitLegacyRedirect(new Request('https://artisys.dev' + path))).toBeNull();
    }
    expect(handleDevkitLegacyRedirect(new Request('https://artisys.dev/devkits/catalogo/',{method:'POST'}))).toBeNull();
  });
});
