export type LearningStatus = 'practice' | 'consolidated' | 'review' | 'pending_review';
export type LearningUnit = { id: string; title: string; competency: string; level: string };
export type LearningProgress = Record<string, { status: LearningStatus; nextReviewAt?: string }>;
export type LearningActionKind = 'diagnostic' | 'pending_review' | 'continue' | 'review' | 'new' | 'explore';
export type LearningAction = { kind: LearningActionKind; unit?: LearningUnit; label: string; mode: 'Conhecer' | 'Praticar' | 'Revisar' | 'Acompanhar' };

export function getProgressLabel(status?: LearningStatus, started = false) {
  if (status === 'pending_review') return 'Aguardando correção';
  if (status === 'consolidated') return 'Dominado';
  if (status === 'review') return 'Praticando';
  if (status === 'practice') return 'Aprendendo';
  return started ? 'Começando' : 'Não iniciado';
}

export function competencySummary(input: { name: string; completed: number; total?: number; status?: LearningStatus; hasActivity?: boolean }) {
  const total = input.total || 5, label = getProgressLabel(input.status, !!input.hasActivity);
  const phrase = input.completed >= total ? `${input.name}: competência fortalecida.` : input.completed > 0 ? `${input.name}: você está avançando.` : `${input.name}: pronta para começar.`;
  return { phrase, label, details: { completed: input.completed, total } };
}

export function getNextLearningAction(input: {
  diagnosticCompleted: boolean;
  diagnosticDraft?: boolean;
  units: LearningUnit[];
  progress?: LearningProgress;
  recommendedLevel?: string;
  completedUnits?: string[];
  now?: number;
  includePending?: boolean;
}): LearningAction {
  if (!input.diagnosticCompleted) return { kind: 'diagnostic', label: input.diagnosticDraft ? 'Retomar sondagem' : 'Começar sondagem', mode: 'Conhecer' };
  const progress = input.progress || {}, now = input.now ?? Date.now();
  const withState = input.units.map(unit => ({ unit, state: progress[unit.id] }));
  const pending = withState.find(x => x.state?.status === 'pending_review');
  if (pending && input.includePending !== false) return { kind: 'pending_review', unit: pending.unit, label: 'Ver correção pendente', mode: 'Acompanhar' };
  const continuing = withState.find(x => x.state?.status === 'practice');
  if (continuing) return { kind: 'continue', unit: continuing.unit, label: 'Continuar atividade', mode: 'Praticar' };
  const due = withState.find(x => x.state?.status === 'review' || (x.state?.nextReviewAt && Date.parse(x.state.nextReviewAt) <= now));
  if (due) return { kind: 'review', unit: due.unit, label: 'Fazer revisão', mode: 'Revisar' };
  const completed = new Set(input.completedUnits || []);
  const fresh = withState.find(x => !x.state && !completed.has(x.unit.id) && (!input.recommendedLevel || x.unit.level === input.recommendedLevel))
    || withState.find(x => !x.state && !completed.has(x.unit.id));
  if (fresh) return { kind: 'new', unit: fresh.unit, label: 'Começar atividade', mode: 'Conhecer' };
  return { kind: 'explore', label: 'Explorar trilhas', mode: 'Conhecer' };
}
