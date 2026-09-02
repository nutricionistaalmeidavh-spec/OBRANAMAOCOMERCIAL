import type { DiagnosticDraft } from './diagnostic-draft';

export type DiagnosticDraftRecord = DiagnosticDraft & {
  participantId: string;
};

export type StoredDiagnosticDraftRecord = DiagnosticDraftRecord & {
  id: string;
};

export interface DiagnosticDraftStore {
  list(table: string): Promise<StoredDiagnosticDraftRecord[]>;
  add(table: string, record: DiagnosticDraftRecord): Promise<void>;
  update(table: string, id: string, record: DiagnosticDraftRecord): Promise<void>;
  delete(table: string, id: string): Promise<void>;
}

export const diagnosticDraftTable = (participantId: string): string =>
  `edu_diagnostic_draft_${participantId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

export async function readDiagnosticDraft(
  store: DiagnosticDraftStore,
  participantId: string,
): Promise<StoredDiagnosticDraftRecord | null> {
  return (await store.list(diagnosticDraftTable(participantId)))[0] || null;
}

export async function saveDiagnosticDraft(
  store: DiagnosticDraftStore,
  participantId: string,
  draft: DiagnosticDraft,
): Promise<DiagnosticDraft> {
  const table = diagnosticDraftTable(participantId);
  const current = await readDiagnosticDraft(store, participantId);
  const record: DiagnosticDraftRecord = { ...draft, participantId };
  if (current) await store.update(table, current.id, record);
  else await store.add(table, record);
  return draft;
}

export async function clearDiagnosticDraft(
  store: DiagnosticDraftStore,
  participantId: string,
): Promise<boolean> {
  const current = await readDiagnosticDraft(store, participantId);
  if (!current) return false;
  await store.delete(diagnosticDraftTable(participantId), current.id);
  return true;
}

