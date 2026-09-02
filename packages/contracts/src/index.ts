import type {
  CompetencyId,
  LearningProgress,
  Role,
  UnitId,
  UserId,
  WorkId,
} from '@drefluxo/domain';

export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface DesktopSession {
  userId: UserId;
  role: Role;
  workId?: WorkId;
  expiresAt: string;
}

export interface LearningProgressEvent {
  userId: UserId;
  competencyId: CompetencyId;
  unitId: UnitId;
  progress: LearningProgress;
  occurredAt: string;
}

export interface SyncChange<T = unknown> {
  id: string;
  entity: 'company' | 'work' | 'membership' | 'learning_progress';
  operation: 'upsert' | 'delete';
  version: number;
  payload?: T;
}

export interface SyncAck {
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
  serverVersion: number;
}

export interface BootstrapResponse {
  session: DesktopSession;
  pendingChanges: SyncChange[];
}

export { isRole, isSyncChange } from './guards.js';
export { canAccessWork } from './auth.js';
export type { AuthenticatedPrincipal, AuthorizationContext } from './auth.js';
export { DEFAULT_SYNC_POLICIES } from './sync-policy.js';
export type { ConflictStrategy, SyncPolicy } from './sync-policy.js';
