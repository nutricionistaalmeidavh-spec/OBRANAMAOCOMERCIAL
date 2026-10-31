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

  it('leva aos destinos canônicos existentes e mantém os canais de contato', () => {
    for (const target of [
      'href="/"',
      'href="/academy"',
      'href="https://www.tiktok.com/@artisysdev"',
      'https://wa.me/5516982338805?text='
    ]) {
      expect(html).toContain(target);
    }
    expect(html).not.toContain('href="/guia/"'); // Ainda está em outra branch.
    expect(html).not.toContain('pagamentos-artisys');
    expect(html).not.toContain('href="/devkits/catalogo/"');
  });

  it('mantém somente a Academy como card e remove os cinco atalhos solicitados', () => {
    const destinations = html.split('<nav class="destinations"')[1]?.split('</nav>')[0] ?? '';
    const cardIds = [...destinations.matchAll(/class="link-card[^"]*"[^>]+data-link-id="([^"]+)"/g)].map(match => match[1]);
    expect(cardIds).toEqual(['academy']);
    expect(destinations).toContain('class="link-card card-feature" href="/academy" data-link-id="academy"');
    expect(destinations).toContain('Trilhas, cursos e lista de espera.');
    expect(destinations).not.toContain('01 — 04');
    expect(html).not.toMatch(/data-link-id="(?:site|sistemas|devkits|whatsapp|obra-portal)"/);
    for (const removed of [
      'Explorar o site completo',
      'Conheça nossos sistemas',
      'DevKit Tool’s',
      'Vamos conversar?',
      'Acessar Obra na Mão',
      'ACESSOS RÁPIDOS'
    ]) {
      expect(html).not.toContain(removed);
    }
    expect(html).not.toContain('class="secondary"');
    expect((html.match(/data-link-id="academy"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-link-id="whatsapp-social"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-link-id="tiktok"/g) ?? [])).toHaveLength(1);
  });

  it('usa cards compactos no mobile sem sacrificar área de toque', () => {
    const mobile = css.split('@media (max-width: 600px)')[1]?.split('@media (max-width: 380px)')[0] ?? '';
    expect(mobile).toContain('.link-card { min-height: 84px; gap: 10px; padding: 10px 12px;');
    expect(mobile).toContain('.card-icon { flex-basis: 42px; height: 42px;');
    expect(mobile).toContain('.card-copy strong { font-size: 16px;');
    expect(mobile).toContain('.card-copy small { font-size: 10.5px;');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('flex: 1');
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
    expect(css).toContain('min-height: 84px');
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
