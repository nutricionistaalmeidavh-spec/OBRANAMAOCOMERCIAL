import type { Role } from '@drefluxo/domain';

const ROLES: Role[] = ['superadmin', 'admin', 'tutor', 'rh', 'collaborator'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role);
}

export function isSyncChange(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const change = value as Record<string, unknown>;
  return typeof change.id === 'string' && typeof change.entity === 'string'
    && typeof change.operation === 'string' && typeof change.version === 'number';
}
