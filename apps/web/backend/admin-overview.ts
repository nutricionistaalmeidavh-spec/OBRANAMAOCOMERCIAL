export type AdminOverviewRole = 'superadmin' | 'admin' | 'rh' | 'gestor' | 'colaborador';

export type AdminOverviewParticipant = {
  id: string;
  name: string;
  email?: string;
  status: string;
  diagnosticCompletedAt?: string;
  skillScores?: Record<string, number>;
  pendingReviews?: Array<Record<string, unknown>>;
  lastActivityAt?: string;
  updatedAt?: string;
  unitProgress?: Record<string, { status?: string; completedAt?: string }>;
};

const ADMIN_OVERVIEW_ROLES: AdminOverviewRole[] = ['superadmin', 'admin', 'rh'];

export function canAccessAdminOverview(role: AdminOverviewRole | undefined): boolean {
  return ADMIN_OVERVIEW_ROLES.includes(role as AdminOverviewRole);
}

export function buildAdminOverview<T extends AdminOverviewParticipant, PublicParticipant>(
  items: T[],
  toParticipant: (participant: T) => PublicParticipant,
) {
  const participants = items.map(toParticipant);
  const pendingReviews = items.flatMap(participant =>
    (participant.pendingReviews || []).map(review => ({
      ...review,
      participantName: participant.name,
      participantEmail: participant.email || '',
    })),
  );
  const now = Date.now();
  const actionParticipants = items.map(participant => {
    const scores = Object.entries(participant.skillScores || {}).sort((a, b) => a[1] - b[1]);
    const difficulty = scores[0]?.[1] < 50 ? { competency: scores[0][0], score: scores[0][1] } : null;
    const pending = participant.pendingReviews?.length || 0;
    const lastActivityAt = participant.lastActivityAt || participant.diagnosticCompletedAt || participant.updatedAt;
    const days = lastActivityAt ? Math.max(0, Math.floor((now - Date.parse(lastActivityAt)) / 86400000)) : null;
    const recentProgress = Object.values(participant.unitProgress || {}).some(unit => unit.completedAt && now - Date.parse(unit.completedAt) <= 7 * 86400000);
    const group = pending ? 'correct_now' : difficulty ? 'needs_help' : days === null || days >= 14 ? 'inactive' : 'evolving';
    return {
      id: participant.id, name: participant.name, email: participant.email || '', group,
      lastActivityAt: lastActivityAt || null, daysSinceActivity: days, pendingReviews: pending,
      difficulty, trend: recentProgress ? 'evolving' : 'stable',
      evidence: pending ? `${pending} resposta(s) aguardando correção` : difficulty ? `${difficulty.competency}: ${difficulty.score}% na sondagem` : days === null ? 'Nenhuma atividade registrada' : `Última atividade há ${days} dia(s)`,
      nextAction: pending ? 'Corrigir resposta' : difficulty ? `Oferecer apoio em ${difficulty.competency}` : days === null || days >= 14 ? 'Convidar para retomar' : 'Acompanhar continuidade',
    };
  }).sort((a, b) => ['correct_now', 'needs_help', 'inactive', 'evolving'].indexOf(a.group) - ['correct_now', 'needs_help', 'inactive', 'evolving'].indexOf(b.group));

  return {
    participants,
    pendingReviews,
    actionParticipants,
    metrics: {
      total: participants.length,
      active: items.filter(participant => participant.status === 'active').length,
      diagnosed: items.filter(participant => participant.diagnosticCompletedAt).length,
      reinforcement: items.filter(participant => Object.values(participant.skillScores || {}).some(score => score < 50)).length,
      publishedUnits: 60,
      competencies: 12,
      areas: 3,
    },
  };
}
