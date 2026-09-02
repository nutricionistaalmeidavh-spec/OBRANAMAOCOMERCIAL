export type LessonItem = {
  kind: 'choice' | 'short-text' | 'text';
  answer: string;
  accept?: string[];
  minLength?: number;
};

export type LessonFeedbackState = 'correct' | 'incorrect' | 'practice' | 'pending_review' | 'completed';

const normalize = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export function evaluateLessonAnswer(item: LessonItem, value: string) {
  const response = value.trim();
  if (item.kind === 'text') {
    const minLength = Math.max(0, Math.floor(Number(item.minLength || 0)));
    return { valid: response.length > 0 && response.length >= minLength, correct: null } as const;
  }

  const correct = normalize(response) === normalize(item.answer)
    || (item.accept || []).some(accepted => normalize(accepted) === normalize(response));
  return { valid: response.length > 0, correct } as const;
}

const feedback: Record<LessonFeedbackState, { title: string; body: string; nextAction: string }> = {
  correct: {
    title: 'Resposta correta',
    body: 'A resposta objetiva está correta. Continue para aplicar a próxima atividade da unidade.',
    nextAction: 'Próxima atividade',
  },
  incorrect: {
    title: 'Revise sua resposta',
    body: 'A resposta objetiva ainda não atende ao esperado. Use o material de apoio e tente novamente.',
    nextAction: 'Tentar novamente',
  },
  practice: {
    title: 'Continuar praticando',
    body: 'A consolidação das respostas objetivas ainda não está completa. Retome a prática para fortalecer esta competência.',
    nextAction: 'Próxima atividade',
  },
  pending_review: {
    title: 'Aguardando correção',
    body: 'RH vai avaliar sua resposta aberta. Depois da avaliação, seu progresso será atualizado.',
    nextAction: 'Próxima atividade',
  },
  completed: {
    title: 'Unidade concluída',
    body: 'A unidade foi concluída. A próxima revisão será apresentada no seu roteiro quando estiver disponível.',
    nextAction: 'Próxima atividade',
  },
};

export function lessonFeedbackViewModel(state: LessonFeedbackState) {
  return feedback[state];
}

export function lessonAccessViewModel(status?: string) {
  return status === 'pending_review'
    ? { readOnly: true, feedback: lessonFeedbackViewModel('pending_review') }
    : { readOnly: false, feedback: null };
}

export function lessonAttemptFeedback(input: { correct: boolean | null; hint?: string; objective?: string }) {
  if (input.correct === false) return {
    tone: 'error' as const,
    title: 'Vamos revisar este ponto',
    body: input.objective ? `Revise: ${input.objective}` : 'Confira a explicação e compare novamente as informações.',
    hint: input.hint || 'Volte ao exemplo antes de tentar novamente.',
    action: 'Tentar novamente',
  };
  if (input.correct === true) return { tone: 'success' as const, title: 'Você acertou', body: input.objective ? `Você aplicou: ${input.objective}` : 'A resposta está correta.', hint: '', action: 'Continuar' };
  return { tone: 'pending' as const, title: 'Resposta enviada', body: 'Sua resposta será analisada. Você pode continuar estudando.', hint: '', action: 'Continuar' };
}
