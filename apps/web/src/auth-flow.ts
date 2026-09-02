export type AuthParticipant = {
  mustChangePassword: boolean;
  diagnosticCompletedAt?: string | null;
  completedUnits?: string[];
};

export type AuthDestination = 'password-change' | 'welcome' | 'journey' | 'home';

export function destinationAfterAuthentication(participant: AuthParticipant): AuthDestination {
  if (participant.mustChangePassword) return 'password-change';
  if (!participant.diagnosticCompletedAt) return 'welcome';
  if (!(participant.completedUnits || []).length) return 'journey';
  return 'home';
}

export function loginMethod(identifier: string): 'google' | 'password' {
  return identifier.trim().includes('@') ? 'google' : 'password';
}

export function shouldRecoverWithGoogle(hasSignedInGoogleSession: boolean, attemptedRecovery = false) {
  return hasSignedInGoogleSession && !attemptedRecovery;
}

export function googleLoginError(error: unknown): string {
  const value = error as { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string; code?: string };
  const status = Number(value?.response?.status || 0);
  const detail = String(value?.response?.data?.error || value?.response?.data?.message || value?.message || '');
  if (status === 403 || /não foi liberado|not authorized|unauthorized/i.test(detail)) return 'Este e-mail ainda não foi liberado pelo RH. Você também pode entrar com celular e senha.';
  if (/cancel|popup|closed|fechad/i.test(`${detail} ${value?.code || ''}`)) return 'O acesso pelo Google foi cancelado. Tente novamente ou entre com celular e senha.';
  return detail || 'Não foi possível entrar com o Google. Tente novamente ou use celular e senha.';
}

export function accountMismatchMessage(typedEmail: string, selectedEmail: string) {
  return typedEmail.trim().toLowerCase() === selectedEmail.trim().toLowerCase()
    ? ''
    : 'A conta escolhida no Google é diferente do e-mail informado. Escolha a mesma conta ou altere o e-mail.';
}
