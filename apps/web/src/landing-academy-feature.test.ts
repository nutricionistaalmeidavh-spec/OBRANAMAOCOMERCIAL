import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const landing = read('../index.html');
const entry = read('./artisys-landing.ts');
const styles = read('./artisys-academy-feature.css');
const seo = read('../seo.config.mjs');

describe('ArtiSys homepage — Academy featured before DevKits', () => {
  it('links to the actual Academy application from the header, hero, featured card and footer', () => {
    const nav = landing.split('id="nav-links"')[1]?.split('</div></nav>')[0] ?? '';
    expect(nav.indexOf('href="/academy"')).toBeGreaterThan(-1);
    expect(nav.indexOf('href="/academy"')).toBeLessThan(nav.indexOf('href="/devkits/"'));
    expect(landing).toContain('class="academy-hero-pill" href="/academy"');
    expect(landing).toContain('class="academy-feature-link" href="/academy"');
    expect(landing).toContain('<a href="/academy">Artisys Academy</a>');
    expect(landing).not.toContain('href="https://artisys.dev/" class="academy-feature-link"');
  });

  it('displays a complete Academy showcase ahead of DevKits without moving or duplicating existing courses', () => {
    const first = landing.indexOf('<section class="academy-feature container" id="academy"');
    const devkits = landing.indexOf('<section class="devkit-feature container" id="devkits"');
    const products = landing.indexOf('<section class="product-highlights container" id="produtos"');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(devkits);
    expect(devkits).toBeLessThan(products);
    expect(landing.match(/<section class="academy-feature container"/g)).toHaveLength(1);

    const card = landing.slice(first, devkits);
    expect(card).toContain('aria-labelledby="academy-feature-title"');
    expect(card).toContain('Última turma encerrada · entre na lista de espera');
    const titles = [...card.matchAll(/class="academy-feature-course-details"><strong>([^<]+)<\/strong>/g)]
      .map(match => match[1]);
    expect(titles).toEqual([
      'Automação de Canal com IA',
      'Desenvolvimento de Sistemas com IA',
      'Engenharia Reversa com IA',
    ]);
    expect(card.match(/class="academy-feature-course" href="\/academy"/g)).toHaveLength(3);
  });

  it('preserves production systems and access to Obra na Mão', () => {
    expect(landing).toContain('class="nav-login" href="./sistema.html#portal"');
    expect(landing).toContain('id="devkits"');
    expect(landing).toContain('href="/devkits/"');
    expect(landing).toContain('href="/sistemas/"');
    expect(landing).toContain('href="/sistemas/obra-na-mao/"');
    expect(landing).toContain('id="prova"');
    expect(landing).toContain('MH Hidráulica LTDA');
  });

  it('uses a responsive, accessible marketing-only Academy visual without paid services', () => {
    expect(entry).toContain("import './artisys-academy-feature.css';");
    for (const token of ['.academy-feature{', '.academy-feature-course{', '@media(max-width:950px)', '@media(max-width:600px)', '@media(prefers-reduced-motion:reduce)', ':focus-visible']) {
      expect(styles).toContain(token);
    }
    expect(styles).not.toMatch(/(\/api\/|stripe|oauth|checkout|\.app-shell)/i);
    expect(seo).toContain("title: 'ArtiSys | Academy, sistemas e DevKits para criar e operar'");
  });
});
