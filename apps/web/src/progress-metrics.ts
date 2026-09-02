export type MetricUnit = { status: string; durationSec?: number; completedAt?: string; updatedAt?: string };

export function progressMetrics(progress: Record<string, MetricUnit> = {}, now = Date.now()) {
  const entries = Object.entries(progress), weekStart = now - 7 * 86400000;
  const completedThisWeek = entries.filter(([, unit]) => unit.completedAt && Date.parse(unit.completedAt) >= weekStart).length;
  const minutes = Math.round(entries.reduce((sum, [, unit]) => sum + Math.max(0, Number(unit.durationSec || 0)), 0) / 60);
  const strengthened = new Set(entries.filter(([, unit]) => ['consolidated', 'review'].includes(unit.status)).map(([id]) => id.replace(/-N[1-5]$/, ''))).size;
  const consolidatedBySkill = new Map<string, number>();
  entries.filter(([, unit]) => unit.status === 'consolidated').forEach(([id]) => { const skill = id.replace(/-N[1-5]$/, ''); consolidatedBySkill.set(skill, (consolidatedBySkill.get(skill) || 0) + 1); });
  const milestones = [...consolidatedBySkill.entries()].filter(([, count]) => count >= 5).map(([skill]) => skill);
  return { completedThisWeek, minutes, strengthened, milestones };
}
