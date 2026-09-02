import type { AuthenticatedPrincipal, DesktopSession } from '@drefluxo/contracts';

export function principalFromSession(session: DesktopSession): AuthenticatedPrincipal {
  return {
    userId: session.userId,
    role: session.role,
    workIds: session.workId ? [session.workId] : [],
    issuedAt: new Date().toISOString(),
    expiresAt: session.expiresAt,
  };
}
