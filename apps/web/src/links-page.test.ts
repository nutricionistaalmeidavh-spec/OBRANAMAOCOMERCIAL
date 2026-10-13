import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Central ArtiSys /links — navegação pública independente', () => {
  const html = read('../public/links/index.html');
  const css = read('../public/links/links.css');

  it('entrega documento próprio com identidade, SEO e acessibilidade', () => {
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('rel="canonical" href="https://artisys.dev/links/"');
    expect(html).toContain('property="og:url" content="https://artisys.dev/links/"');
    expect(html).toContain('name="description"');
    expect(html).toContain('href="/artisys-logo.svg"');
    expect(html).toContain('class="skip-link" href="#conteudo"');
    expect(html).toMatch(/<main[^>]*id="conteudo"/);
    expect(html).toContain('aria-label="Redes e canais ArtiSys"');
    expect(html).not.toContain('href="#"');
  });

  it('leva aos destinos canônicos existentes e ao material gratuito de verdade', () => {
    for (const target of [
      'href="/"',
      'href="/sistemas/"',
      'href="/devkits/"',
      'href="/devkits/#repos-tiktok"',
      'href="/sistema.html#portal"',
      'href="https://www.tiktok.com/@artisysdev"',
      'https://wa.me/5516982338805?text='
    ]) {
      expect(html).toContain(target);
    }
    expect(html).not.toContain('href="/guia/"'); // Ainda está em outra branch.
    expect(html).not.toContain('pagamentos-artisys');
    expect(html).not.toContain('href="/devkits/catalogo/"');
  });

  it('exibe TikTok @artisysdev e WhatsApp, sem Instagram ou GitHub na central', () => {
    const social = html.split('<nav class="social-nav"')[1]?.split('</nav>')[0] ?? '';
    expect(social).toContain('href="https://www.tiktok.com/@artisysdev"');
    expect(social).toContain('aria-label="TikTok da ArtiSys"');
    expect(social).toContain('data-link-id="tiktok"');
    expect(social).toContain('data-link-id="whatsapp-social"');
    expect(social).not.toContain('instagram.com');
    expect(social).not.toContain('github.com');
    expect(social).not.toContain('data-link-id="instagram"');
    expect(social).not.toContain('data-link-id="github"');
    expect((social.match(/<a /g) || [])).toHaveLength(2);
  });

  it('é mobile-first, navegável pelo teclado e respeita movimento reduzido', () => {
    expect(html).toContain('name="viewport"');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('min-height: 56px');
    expect(html).not.toMatch(/<script[^>]+src=["'][^"']+google-analytics/i);
  });

  it('não substitui a landing, checkout nem interfere na roteirização da API', () => {
    const landing = read('../index.html');
    const workerConfig = read('../wrangler.jsonc');
    expect(landing).toContain('id="hero-title"');
    expect(landing).toContain('href="./sistema.html#portal"');
    expect(workerConfig).toContain('"/api/*"');
    expect(workerConfig).toContain('"not_found_handling": "single-page-application"');
    expect(read('../seo.config.mjs')).toContain("path: '/links'");
  });
});
