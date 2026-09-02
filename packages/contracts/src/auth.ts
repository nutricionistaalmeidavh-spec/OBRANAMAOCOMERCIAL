import type { Role, UserId, WorkId } from '@drefluxo/domain';

export interface AuthenticatedPrincipal {
  userId: UserId;
  role: Role;
  workIds: WorkId[];
  issuedAt: string;
  expiresAt: string;
}

export interface AuthorizationContext {
  principal: AuthenticatedPrincipal;
  resourceWorkId?: WorkId;
}

export function canAccessWork(context: AuthorizationContext): boolean {
  if (!context.resourceWorkId) return true;
  return context.principal.role === 'superadmin' || context.principal.workIds.includes(context.resourceWorkId);
}
