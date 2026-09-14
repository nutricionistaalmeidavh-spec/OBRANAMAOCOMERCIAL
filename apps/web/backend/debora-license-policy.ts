export const MANUAL_PLAN_CODE = 'pro_6m';
export const MANUAL_PLAN_MONTHS = 6;

export function normalizeDeboraLicenseEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function buildDeboraGrantPayload(value: unknown) {
  const email = normalizeDeboraLicenseEmail(value);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.');
  return {
    action: 'grant' as const,
    email,
    planCode: MANUAL_PLAN_CODE,
    months: MANUAL_PLAN_MONTHS,
    source: 'mercado_livre_manual' as const,
  };
}
