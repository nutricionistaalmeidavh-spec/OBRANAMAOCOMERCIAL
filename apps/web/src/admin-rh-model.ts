const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  rh: 'RH',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
};

const GROUP_LABELS: Record<string, string> = {
  correct_now: 'Corrigir agora',
  needs_help: 'Pode precisar de ajuda',
  inactive: 'Sem atividade recente',
  evolving: 'Evoluindo',
};

export function educationRoleLabel(role: string): string {
  return ROLE_LABELS[role] || 'Colaborador';
}

export function adminGroupLabel(group: string): string {
  return GROUP_LABELS[group] || group;
}

export function adminFailureStatus(error: unknown): number {
  const value = error as {
    response?: { status?: number; data?: { status?: number } };
    status?: number;
  };
  return Number(value.response?.status || value.response?.data?.status || value.status || 0);
}

export function adminFailureDetail(error: unknown): string {
  const status = adminFailureStatus(error);
  if (status === 401) return 'Sua sessão expirou. Entre novamente para acessar a Administração RH.';
  if (status === 403) return 'Você não tem permissão para acessar a Administração RH.';
  return 'Não foi possível carregar a Administração RH. Tente novamente.';
}

