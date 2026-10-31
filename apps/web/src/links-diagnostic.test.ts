import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
describe('Diagnóstico via /links', () => {
  const links = read('../public/links/index.html');
  const html = read('../public/links/diagnostico/index.html');
  const js = read('../public/links/diagnostico/diagnostico.js');
  const css = read('../public/links/diagnostico/diagnostico.css');
  it('tem acesso explícito na Central, sem substituir o único card atual da Academy', () => {
    expect(links).toContain('href="/links/diagnostico/"');
    expect(links).toContain('data-link-id="diagnostico"');
    expect(links).toContain('src="/links/links-motion.js" defer');
    const destinations = links.split('<nav class="destinations"')[1]?.split('</nav>')[0] || '';
    expect((destinations.match(/class="link-card /g) || [])).toHaveLength(1);
  });
  it('mostra o formulário acima da Academy sem alterar canais ou motion', () => {
    const diagnosticIndex = links.indexOf('class="diagnostic-callout"');
    const academyIndex = links.indexOf('data-link-id="academy"');
    const socialIndex = links.indexOf('class="social-nav"');
    expect(diagnosticIndex).toBeGreaterThan(0);
    expect(academyIndex).toBeGreaterThan(diagnosticIndex);
    expect(socialIndex).toBeGreaterThan(academyIndex);
    expect((links.match(/data-link-id="diagnostico"/g) || [])).toHaveLength(1);
    expect((links.match(/data-link-id="academy"/g) || [])).toHaveLength(1);
    const motions = read('../public/links/links-motion.js');
    expect(motions).toContain('reveal(".diagnostic-callout"');
    expect(motions.indexOf('reveal(".diagnostic-callout"')).toBeLessThan(motions.indexOf('reveal(academy'));
    expect(motions).toContain('prefers-reduced-motion: reduce');
  });
  it('tem formulário acessível em etapas com contato, problema e consentimento', () => {
    for (const field of ['name','company','email','sector','teamSize','painPoints','goal','weeklyHours','urgency','consent']) {
      expect(html).toContain(field);
    }
    expect(html).toContain('name="consent"');
    expect((html.match(/class="wizard-step"/g) || [])).toHaveLength(5);
    for (const attribute of ['serverKind','serverProvider','serverAdmin','workDevices','offlineNeed','usersCount','integrations','integrationOther','softwareSpend','monthlyRevenue','sensitiveData']) {
      expect(html).toContain(`name="${attribute}"`);
    }
    expect(html).toContain('aria-valuemax="5"');
    expect(html).toContain('data-step="4"');
    expect(js).toContain("syncServer()");
    expect(js).toContain("syncIntegrations(null)");
    expect(js).toContain("data.workDevices = fields.getAll('workDevices')");
    expect(js).toContain("data.integrations = fields.getAll('integrations')");
    expect(js).toContain("data.sensitiveData = fields.getAll('sensitiveData')");
    expect(css).toContain('.conditional-field[hidden]');
    expect(html).toContain('name="currentSystems"');
    for (const tool of ['planilhas', 'whatsapp', 'pdv', 'erp', 'crm', 'tarefas-projetos', 'sistema-proprio', 'outros', 'nenhum']) {
      expect(html).toContain(`name="currentSystems" value="${tool}"`);
    }
    expect(html).toContain('type="checkbox" name="currentSystems"');
    expect(html).toContain('id="current-systems-other"');
    for (const key of ['pdv', 'erp', 'crm', 'tarefas-projetos', 'sistema-proprio']) {
      expect(html).toContain(`data-system-name-for="${key}"`);
      expect(html).toContain(`name="systemName_${key}"`);
    }
    expect(js).toContain("data.currentSystemNames = Object.fromEntries");
    expect(js).toContain("nameInput.required = selected");
    expect(css).toContain('.system-name-field[hidden]');
    expect(js).toContain("fields.getAll('currentSystems')");
    expect(js).toContain("changed.value === 'nenhum'");
    expect(css).toContain('border-radius: 50%');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('name="viewport"');
    expect(html).not.toContain('GEMINI_API_KEY');
    expect(js).toContain('/api/public/diagnostico');
    expect(js).toContain('response.ok');
    expect(css).toContain('@media (max-width: 640px)');
  });
});