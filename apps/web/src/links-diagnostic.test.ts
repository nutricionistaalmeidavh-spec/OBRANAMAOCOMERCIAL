import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
describe('Diagnóstico via /links', () => {
  const links = read('../public/links/index.html');
  const html = read('../public/links/diagnostico/index.html');
  const js = read('../public/links/diagnostico/diagnostico.js');
  const css = read('../public/links/diagnostico/diagnostico.css');
  it('tem acesso explícito na Central, sem substituir os quatro cards existentes', () => {
    expect(links).toContain('href="/links/diagnostico/"');
    expect(links).toContain('data-link-id="diagnostico"');
    const destinations = links.split('<nav class="destinations"')[1]?.split('</nav>')[0] || '';
    expect((destinations.match(/class="link-card /g) || [])).toHaveLength(4);
  });
  it('tem formulário acessível em etapas com contato, problema e consentimento', () => {
    for (const field of ['name','company','email','sector','teamSize','painPoints','goal','weeklyHours','urgency','consent']) {
      expect(html).toContain(field);
    }
    expect(html).toContain('name="consent"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('name="viewport"');
    expect(html).not.toContain('GEMINI_API_KEY');
    expect(js).toContain('/api/public/diagnostico');
    expect(js).toContain('response.ok');
    expect(css).toContain('@media (max-width: 640px)');
  });
});