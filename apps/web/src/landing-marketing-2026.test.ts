import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const landing = read('../index.html');
const marketing = read('./artisys-marketing-2026.css');
const devkits = read('../public/devkits/index.html');

describe('public ArtiSys landing — conversion and access guardrails', () => {
  it('preserves Obra na Mão access in the header, independently of the mobile menu', () => {
    const access = landing.match(/<a class="nav-login"[^>]+>/)?.[0] ?? '';
    expect(access).toContain('href="./sistema.html#portal"');
    expect(access).toContain('aria-label="Acessar sistema Obra na Mão"');
    expect(landing).toContain('class="nav-login-mobile">Acessar sistema');
    expect(landing).toContain('https://wa.me/5516982338805?text=');
    expect(landing.match(/https:\/\/wa\.me\/5516982338805\?text=/g)).toHaveLength(2);
    expect(landing).not.toContain('5516999999999');
    expect(marketing).toMatch(/@media\(max-width:800px\)/);
    expect(marketing).toContain('.nav-login-mobile{display:inline}');
  });

  it('makes the catalog and the developer-kit destination discoverable', () => {
    expect(landing).toContain('href="/sistemas/"');
    expect(landing).toContain('href="/devkits/"');
    expect(landing).toContain('id="devkit-title"');
    expect(landing).toContain('id="products-title"');
    expect(landing).toContain('id="dos-videos"');
    expect(landing).toContain('Prévia ilustrativa'.toUpperCase());
    for (const slug of ['obra-na-mao', 'pdv-artisys', 'nutridesk']) {
      expect(landing).toContain(`href="/sistemas/${slug}/"`);
    }
  });

  it('keeps developer-kit claims precise and sends visitors to a real catalog', () => {
    for (const sku of ['DKT-DOC-005', 'DKT-DOC-008', 'DKT-PLAT-006', 'DKT-QUAL-005']) {
      expect(landing).toContain(sku);
    }
    expect(devkits).not.toContain('github.com/nutricionistaalmeidavh-spec/DevKitTools');
    expect(devkits).toContain('https://wa.me/5516982338805?text=');
    expect(devkits).toContain('rel="canonical" href="https://artisys.dev/devkits/"');
    expect(devkits).toContain('id="kit-grid"');
    expect(devkits).toContain('Guia Open Source');
    expect(devkits).toContain('href="https://github.com/rclone/rclone"');
    expect(devkits).not.toContain('href="/devkits/catalogo/"');

  });
});
