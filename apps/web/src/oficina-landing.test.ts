import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { artisysSeoConfig } from '../seo.config.mjs';

const base = new URL('../public/oficina/', import.meta.url);
const html = () => readFileSync(new URL('index.html', base), 'utf8');
const css = () => readFileSync(new URL('style.css', base), 'utf8');
const js = () => readFileSync(new URL('motion.js', base), 'utf8');
const assets = ['dashboard.webp','ordens.webp','ordem-detalhe.webp','relatorios.webp','os-entrada.webp','orcamento.webp','vendas.webp','estoque.webp','inventario.webp','dashboard-mobile.webp'];

describe('Landing ArtiSys Oficina · rota isolada', () => {
  it('tem rota /oficina/ real e SEO independente', () => {
    expect(artisysSeoConfig.pages.some(p => p.path === '/oficina' && p.canonical === 'https://artisys.dev/oficina/')).toBe(true);
    expect(html()).toContain('<link rel="canonical" href="https://artisys.dev/oficina/">');
    expect(html()).toContain('"@type":"SoftwareApplication"');
    expect(html()).toContain('id="conteudo"');
    expect(html()).toContain('href="#conteudo"');
  });
  it('usa capturas genuínas de QA e nenhuma tela fabricada', () => {
    for (const name of assets) {
      const path = new URL(`media/${name}`, base);
      expect(existsSync(path), name).toBe(true);
      const buffer = readFileSync(path);
      expect(buffer.length, name).toBeGreaterThan(5000);
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buffer.toString('ascii', 8, 12)).toBe('WEBP');
      expect(html()).toContain(`/oficina/media/${name}`);
    }
    expect(html()).toContain('capturas reais');
    expect(html()).toContain('dados fictícios');
    expect(html()).not.toMatch(/unsplash|picsum|placeholder|mockup fictício/i);
  });
  it('tem hero, bento, galeria acessível e CTAs reais', () => {
    expect(html()).toContain('id="recursos"');
    expect(html()).toContain('id="telas"');
    expect(html()).toContain('id="galeria"');
    expect(html()).toContain('id="galeria-anterior"');
    expect(html()).toContain('id="galeria-proxima"');
    expect(html()).toContain('mercadolivre.com.br/pagina/artisys');
    expect(html()).toContain('wa.me/5516982338805');
    expect(html()).toContain('Windows');
    expect(html()).toContain('PostgreSQL');
    expect(html()).toContain('rede local');
    expect(html()).toContain('Não emite notas fiscais');
    expect(html()).not.toContain('R$ 89,90');
  });
  it('é mobile-first, sem dependência CDN, com movimento reduzido e observabilidade opcional', () => {
    expect(css()).toContain('prefers-reduced-motion: reduce');
    expect(css()).toContain(':focus-visible');
    expect(css()).toContain('@media (max-width:640px)');
    expect(js()).toContain('IntersectionObserver');
    expect(js()).toContain('scrollBy');
    expect(js()).toContain('prefers-reduced-motion');
    expect(html()).not.toMatch(/<script[^>]+src="https?:\/\//i);
    expect(html()).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="https?:\/\//i);
    expect(html()).toContain('data-analytics-consent');
  });
});
