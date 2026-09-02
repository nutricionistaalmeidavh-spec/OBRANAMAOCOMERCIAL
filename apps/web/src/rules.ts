export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

export type DiagnosticLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

export function nextDiagnosticLevel(level: number, correct: boolean): number {
  if (!correct) return Math.max(1, level - 1);
  return Math.min(5, level + 1);
}

export function diagnosticAssignment(level: number, correct: boolean): DiagnosticLevel {
  return `N${nextDiagnosticLevel(level, correct)}` as DiagnosticLevel;
}

export function canAccessAdmin(role: string | undefined | null): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'rh';
}

export function canManageRoles(role: string | undefined | null): boolean {
  return role === 'superadmin' || role === 'admin';
}

export function reviewInterval(stage: number, successful: boolean): number {
  const current = Math.max(0, Math.min(REVIEW_INTERVALS.length - 1, stage));
  const next = successful ? current : Math.max(0, current - 1);
  return REVIEW_INTERVALS[next];
}

export function isUnitConsolidated(totalItems: number, correctItems: number): boolean {
  return totalItems > 0 && correctItems === totalItems;
}

