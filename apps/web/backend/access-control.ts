export const EDUCATION_ROLES = ['superadmin', 'admin', 'rh', 'gestor', 'colaborador'] as const;
export type EduRole = (typeof EDUCATION_ROLES)[number];

export const ADMINISTRATION_ROLES: readonly EduRole[] = ['superadmin', 'admin', 'rh'];

export type RoleChangeDecision =
  | 'allowed'
  | 'actor-not-allowed'
  | 'admin-boundary'
  | 'self-superadmin-demotion';

export function isEducationRole(value: unknown): value is EduRole {
  return typeof value === 'string' && EDUCATION_ROLES.includes(value as EduRole);
}

export function effectiveEducationRole(role: unknown, jobRole?: string): EduRole {
  if (isEducationRole(role)) return role;
  return jobRole === 'Administração' ? 'admin' : 'colaborador';
}

export function isAdministrationRole(role: EduRole | null | undefined): boolean {
  return !!role && ADMINISTRATION_ROLES.includes(role);
}

export function canManageEducationRoles(role: EduRole | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin';
}

export function educationJobRole(role: EduRole, currentJobRole = 'Colaborador'): string {
  return isAdministrationRole(role) ? 'Administração' : currentJobRole;
}

export function educationRoleChangeDecision(input: {
  actorRole: EduRole;
  targetRole: EduRole;
  nextRole: EduRole;
  isSelf: boolean;
}): RoleChangeDecision {
  const { actorRole, targetRole, nextRole, isSelf } = input;
  if (!canManageEducationRoles(actorRole)) return 'actor-not-allowed';
  if (
    actorRole === 'admin' &&
    (targetRole === 'superadmin' || targetRole === 'admin' || nextRole === 'superadmin' || nextRole === 'admin')
  ) {
    return 'admin-boundary';
  }
  if (actorRole === 'superadmin' && isSelf && nextRole !== 'superadmin') {
    return 'self-superadmin-demotion';
  }
  return 'allowed';
}

