import { describe, expect, it, vi } from 'vitest';
import { handlePublicDiagnostic, validateDiagnosticPayload } from './public-diagnostic';

const payload = () => ({
  name: 'Ana Souza', company: 'Oficina Exemplo', email: 'ana@exemplo.com', whatsapp: '16999998888',
  sector: 'servicos', teamSize: '6-20', painPoints: ['tarefas-manuais', 'estoque'],
  currentSystems: 'Planilhas', weeklyHours: '6-10', goal: 'Organizar o controle de peças e melhorar a operação.',
  urgency: '1-3m', migration: 'sim', consent: true, website: ''
});
const req = (body: unknown, headers: Record<string, string> = {}) => new Request('https://artisys.dev/api/public/diagnostico', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://artisys.dev', ...headers }, body: JSON.stringify(body)
});
function envFake() {
  const queries: Array<{ query: string; args: unknown[] }> = [];
  const env = { DB: { prepare(query: string) { const item = { query, args: [] as unknown[] }; queries.push(item); return {
    bind(...args: unknown[]) { item.args = args; return this; },
    async first() { return { count: 1 }; }, async run() { return { success: true }; }
  }; } } };
  return { env, queries };
}

describe('Diagnóstico público ArtiSys', () => {
  it('valida requisitos antes de gravar e sanitiza entradas', () => {
    const result = validateDiagnosticPayload({ ...payload(), name: '  Ana Souza  ', email: ' ANA@EXEMPLO.COM ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Ana Souza');
      expect(result.value.email).toBe('ana@exemplo.com');
      expect(result.value.painPoints).toEqual(['tarefas-manuais', 'estoque']);
    }
  });
  it('exige consentimento e problema real', () => {
    expect(validateDiagnosticPayload({ ...payload(), consent: false }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), painPoints: [] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), goal: '' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), painPoints: ['x'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), goal: 'a'.repeat(601) }).ok).toBe(false);
  });
  it('persiste somente no D1, sem autenticação ou provedores pagos', async () => {
    const { env, queries } = envFake();
    const response = await handlePublicDiagnostic(req(payload(), {'cf-connecting-ip': '192.0.2.10'}), env);
    expect(response?.status).toBe(201);
    const result = await response!.json() as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.protocol).toBeTruthy();
    const row = queries.find(x => x.query.includes('INSERT INTO kv_records'));
    expect(row).toBeDefined();
    expect(row!.args[0]).toBe('artisys_diagnostic_leads_v1');
    const saved = JSON.parse(String(row!.args[2]));
    expect(saved.email).toBe('ana@exemplo.com');
    expect(saved.consent).toBe(true);
    expect(saved.source).toBe('/links/diagnostico/');
  });
  it('não permite origem externa ou conteúdo incorreto', async () => {
    const { env, queries } = envFake();
    expect((await handlePublicDiagnostic(req(payload(), { origin: 'https://evil.example' }), env))?.status).toBe(403);
    expect((await handlePublicDiagnostic(req(payload(), { 'content-type': 'text/plain' }), env))?.status).toBe(415);
    expect(queries).toHaveLength(0);
  });
  it('não captura rotas vizinhas', async () => {
    const { env } = envFake();
    expect(await handlePublicDiagnostic(new Request('https://artisys.dev/api/auth/me'), env)).toBeNull();
  });
});