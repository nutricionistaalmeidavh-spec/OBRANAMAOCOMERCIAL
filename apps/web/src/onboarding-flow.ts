export type OnboardingState = 'welcome' | 'diagnostic' | 'journey' | 'returning';

export function onboardingState(input: { diagnosticCompletedAt?: string | null; diagnosticDraft?: boolean; completedUnits?: string[] }): OnboardingState {
  if (!input.diagnosticCompletedAt) return input.diagnosticDraft ? 'diagnostic' : 'welcome';
  if (!(input.completedUnits || []).length) return 'journey';
  return 'returning';
}
