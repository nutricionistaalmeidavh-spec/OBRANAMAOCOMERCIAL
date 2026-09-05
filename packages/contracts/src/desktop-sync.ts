/** Operational sync contract shared by the Desktop UI and Cloudflare boundary. */
export const DESKTOP_SYNC_ENTITIES = ['frentes_obra','tarefas_obra','rdos','rdo_equipe','rdo_equipamentos','rdo_ocorrencias','rdo_anexos','cronograma_etapas'] as const;
export function validateDesktopChange(change: Record<string, unknown>): string | null {
  if (!(DESKTOP_SYNC_ENTITIES as readonly unknown[]).includes(change.entity)) return 'Entidade não permitida na sincronização.';
  if (typeof change.changeId !== 'string' || change.changeId.length < 12 || change.changeId.length > 160) return 'Identificador de alteração inválido.';
  if (!Number.isSafeInteger(change.localId) || Number(change.localId) <= 0) return 'Identificador local inválido.';
  if (change.baseMobileRevision !== undefined && (!Number.isSafeInteger(change.baseMobileRevision) || Number(change.baseMobileRevision) < 0)) return 'Revisão de origem inválida.';
  if (!change.payload || typeof change.payload !== 'object' || Array.isArray(change.payload)) return 'Dados da alteração inválidos.';
  if (JSON.stringify(change).length > 120000) return 'Alteração excede o limite de sincronização.';
  return null;
}
export type DesktopSyncScope = {
  companyId: number; workId: number; companyName: string; workName: string;
  baseUrl: string; deviceId: string; remoteCompanyId: string; remoteProjectId: string;
};
export type DesktopSyncState = {
  configured: boolean; paused: boolean; running: boolean; scope: DesktopSyncScope | null;
  pending: number; lastSyncAt: string | null; lastError: string | null;
  conflicts: Array<{id: number; entity: string; localId: number; remoteRevision: number; remoteConflictId: string | null; createdAt: string}>;
};
export type LocalConflictResolution = 'keep_local' | 'accept_remote';
