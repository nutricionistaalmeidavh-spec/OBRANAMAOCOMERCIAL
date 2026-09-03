/** Portal-only read model. Never send the Desktop snapshot to the overview. */
export type OverviewAccess = {
  needsClaim?: boolean;
  role?: string;
  platformAccess?: { status?: string; systems?: { gestao?: { enabled?: boolean; role?: string } } } | null;
  access?: { modules?: string[]; channels?: string[] } | null;
};
const OVERVIEW_MODULES = ['dre', 'contracts', 'measurements', 'documents'];
export function canReadOverview(context: OverviewAccess): boolean {
  const grant = context.platformAccess?.systems?.gestao;
  return context.needsClaim !== true && context.role === 'admin'
    && context.platformAccess?.status === 'active' && grant?.enabled === true
    && ['admin', 'consulta'].includes(grant.role || '')
    && context.access?.channels?.includes('mobile') === true
    && context.access.modules?.some(module => OVERVIEW_MODULES.includes(module)) === true;
}
export type OverviewItem = { key: string; label: string; value: number; kind: 'money' | 'count' };
export type PortalOverview = { updatedAt: string | null; metrics: OverviewItem[]; attention: OverviewItem[] };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function projectOverview(summary: unknown, modules: string[], publishedAt?: unknown): PortalOverview {
  const source = record(summary), data = record(source.modules);
  const output: PortalOverview = { updatedAt: null, metrics: [], attention: [] };
  const stamp = source.generatedAt || publishedAt;
  if (typeof stamp === 'string' && Number.isFinite(Date.parse(stamp))) output.updatedAt = new Date(stamp).toISOString();
  const add = (module: string, field: string, label: string, kind: OverviewItem['kind'], attention = false) => {
    if (!modules.includes(module)) return;
    const value = record(data[module])[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || (kind === 'count' && (value < 0 || !Number.isInteger(value)))) return;
    (attention ? output.attention : output.metrics).push({ key: module, label, value, kind });
  };
  add('dre', 'result', 'Resultado', 'money');
  add('contracts', 'active', 'Contratos ativos', 'count');
  add('measurements', 'open', 'Medições em aberto', 'count', true);
  add('documents', 'expiring30d', 'Documentos a vencer em 30 dias', 'count', true);
  return output;
}
