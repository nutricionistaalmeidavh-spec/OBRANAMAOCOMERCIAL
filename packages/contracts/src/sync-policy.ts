export type ConflictStrategy = 'server-wins' | 'client-wins' | 'manual-review';

export interface SyncPolicy {
  entity: 'company' | 'work' | 'membership' | 'learning_progress';
  strategy: ConflictStrategy;
  requiresVersion: boolean;
}

export const DEFAULT_SYNC_POLICIES: SyncPolicy[] = [
  { entity: 'company', strategy: 'server-wins', requiresVersion: true },
  { entity: 'work', strategy: 'manual-review', requiresVersion: true },
  { entity: 'membership', strategy: 'server-wins', requiresVersion: true },
  { entity: 'learning_progress', strategy: 'client-wins', requiresVersion: true },
];
