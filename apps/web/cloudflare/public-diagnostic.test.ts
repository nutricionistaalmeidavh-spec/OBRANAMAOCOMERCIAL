import { describe, expect, it, vi } from 'vitest';
import { handlePublicDiagnostic, validateDiagnosticPayload } from './public-diagnostic';

const payload = () => ({
  name: 'Ana Souza', company: 'Oficina Exemplo', email: 'ana@exemplo.com', whatsapp: '16999998888',
  sector: 'servicos', teamSize: '6-20', painPoints: ['tarefas-manuais', 'estoque'],
  currentSystems: ['planilhas', 'whatsapp'], currentSystemsOther: '', currentSystemNames: {}, weeklyHours: '6-10', goal: 'Organizar o controle de peças e melhorar a operação.',
  serverKind: 'cloud', serverProvider: 'VPS Própria', serverAdmin: '',
  workDevices: ['computer', 'phone'], offlineNeed: 'nice-to-have', usersCount: '6-20',
  integrations: ['whatsapp', 'banks'], integrationOther: '',
  softwareSpend: '201-500', monthlyRevenue: '50-200k', sensitiveData: ['customers', 'financial'],
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
      expect(result.value.currentSystems).toEqual(['planilhas', 'whatsapp']);
    }
  });
  it('exige consentimento e problema real', () => {
    expect(validateDiagnosticPayload({ ...payload(), consent: false }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), painPoints: [] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), goal: '' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), painPoints: ['x'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), goal: 'a'.repeat(601) }).ok).toBe(false);
  });
  it('aceita múltiplas ferramentas, opção nenhuma e opção outro com descrição', () => {
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['planilhas', 'whatsapp', 'pdv'], currentSystemNames: { pdv: 'PDV da oficina' } }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: [] }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['nenhum'] }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['outros'], currentSystemsOther: 'Software de agendamento' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['outros'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['nenhum', 'whatsapp'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['planilhas', 'planilhas'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['ferramenta-desconhecida'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['whatsapp'], currentSystemsOther: 'dado inesperado' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: 'Planilhas' }).ok).toBe(false);
  });
  it('exige nome individual de cada PDV, ERP, CRM, gestão de projetos e sistema próprio selecionado', () => {
    const kinds = ['pdv', 'erp', 'crm', 'tarefas-projetos', 'sistema-proprio'];
    const names = {
      pdv: 'PDV Exemplo', erp: 'ERP Exemplo', crm: 'CRM Exemplo',
      'tarefas-projetos': 'Gerenciador Exemplo', 'sistema-proprio': 'Sistema interno'
    };
    for (const key of kinds) {
      expect(validateDiagnosticPayload({ ...payload(), currentSystems: [key], currentSystemNames: {} }).ok).toBe(false);
      expect(validateDiagnosticPayload({ ...payload(), currentSystems: [key], currentSystemNames: { [key]: names[key as keyof typeof names] } }).ok).toBe(true);
    }
    const all = validateDiagnosticPayload({ ...payload(), currentSystems: kinds, currentSystemNames: names });
    expect(all.ok).toBe(true);
    if (all.ok) expect(all.value.currentSystemNames).toEqual(names);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: kinds, currentSystemNames: { pdv: names.pdv } }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['pdv'], currentSystemNames: { crm: 'Não selecionado', pdv: names.pdv } }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: [], currentSystemNames: { pdv: 'Extra' } }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['pdv'], currentSystemNames: { pdv: ' ' } }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['pdv'], currentSystemNames: { pdv: 'x'.repeat(161) } }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), currentSystems: ['pdv'], currentSystemNames: 'texto inválido' }).ok).toBe(false);
  });
  it('classifica servidor físico, VPS e ausência de servidor com subperguntas condicionais', () => {
    expect(validateDiagnosticPayload({ ...payload(), serverKind: 'local', serverProvider: '', serverAdmin: 'internal' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), serverKind: 'local', serverProvider: '', serverAdmin: '' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), serverKind: 'computers', serverProvider: '', serverAdmin: '' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), serverKind: 'unknown', serverProvider: '', serverAdmin: '' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), serverKind: 'cloud', serverProvider: 'VPS ABC', serverAdmin: '' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), serverKind: 'computers', serverProvider: 'dados não exibidos', serverAdmin: '' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), serverKind: 'cloud', serverProvider: '', serverAdmin: 'third-party' }).ok).toBe(false);
  });
  it('valida os dispositivos, a internet offline e os usuários com faixas e sem respostas vazias', () => {
    expect(validateDiagnosticPayload({ ...payload(), workDevices: [] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), workDevices: ['computer','phone','tablet'] }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), workDevices: ['phone','phone'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), offlineNeed: 'invalido' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), usersCount: '101-200' }).ok).toBe(false);
  });
  it('permite múltiplas integrações, mas nunca mistura nenhuma/não sei, exige descrição de outro', () => {
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['none'] }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['unknown'] }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), integrations: [] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['none','whatsapp'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['none','unknown'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['banks','banks'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['other'], integrationOther: '' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['other'], integrationOther: 'API do sistema interno' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), integrations: ['banks'], integrationOther: 'extra não selecionado' }).ok).toBe(false);
  });
  it('coleta faturamento somente em faixas, com privacidade, e dados por categoria', () => {
    expect(validateDiagnosticPayload({ ...payload(), monthlyRevenue: 'prefer-not' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), softwareSpend: 'prefer-not' }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), monthlyRevenue: '100000.00' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), softwareSpend: '1000' }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), sensitiveData: ['health','employees'] }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), sensitiveData: ['none'] }).ok).toBe(true);
    expect(validateDiagnosticPayload({ ...payload(), sensitiveData: ['none','health'] }).ok).toBe(false);
    expect(validateDiagnosticPayload({ ...payload(), sensitiveData: [] }).ok).toBe(false);
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
    expect(saved.currentSystems).toEqual(['planilhas', 'whatsapp']);
    expect(saved.currentSystemsOther).toBe('');
    expect(saved.currentSystemNames).toEqual({});
    expect(saved.serverKind).toBe('cloud');
    expect(saved.serverProvider).toBe('VPS Própria');
    expect(saved.workDevices).toEqual(['computer','phone']);
    expect(saved.offlineNeed).toBe('nice-to-have');
    expect(saved.usersCount).toBe('6-20');
    expect(saved.integrations).toEqual(['whatsapp','banks']);
    expect(saved.softwareSpend).toBe('201-500');
    expect(saved.monthlyRevenue).toBe('50-200k');
    expect(saved.sensitiveData).toEqual(['customers','financial']);
    expect(saved.version).toBe(2);
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