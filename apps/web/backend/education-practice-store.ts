import { db } from '@appdeploy/sdk';
import { normalizeGameProgress, type GameProgressRecord } from './game-progress-model';

export type StoredPracticeRun = GameProgressRecord & { id?: string };

const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');
export const practiceRunTable = (participantId: string) => 'edu_practice_runs_' + safe(participantId);
export const legacyGameProgressTable = (participantId: string) => 'edu_game_progress_' + safe(participantId);

function newestFirst(records: GameProgressRecord[]) {
  return [...records].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}

function dedupe(records: GameProgressRecord[]) {
  const seen = new Set<string>();
  const result: GameProgressRecord[] = [];
  for (const record of newestFirst(records)) {
    const key = record.runId || `${record.baseActivityId || record.activityId}:${record.variantFingerprint || 'fixed'}:${record.completedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }
  return result;
}

async function trimCanonicalHistory(participantId: string, maxRecords = 200) {
  const table = practiceRunTable(participantId);
  const items = (await db.list<StoredPracticeRun>(table, { limit: Math.max(260, maxRecords + 60) })).items
    .filter(item => item.id)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const stale = items.slice(maxRecords).map(item => String(item.id));
  if (stale.length) await db.delete(table, stale);
}

export async function savePracticeRun(participantId: string, input: unknown) {
  const normalized = normalizeGameProgress(input);
  if (!normalized) return null;
  const table = practiceRunTable(participantId);
  const existing = (await db.list<StoredPracticeRun>(table, { limit: 220 })).items.find(item => item.runId === normalized.runId);
  if (existing?.id) await db.update(table, [{ id: existing.id, record: normalized }]);
  else await db.add(table, [normalized]);
  await trimCanonicalHistory(participantId);
  return normalized;
}

export async function listPracticeRuns(participantId: string, options: { unitId?: string; skillId?: string; limit?: number } = {}) {
  const max = Math.max(1, Math.min(200, options.limit || 200));
  const [canonical, legacy] = await Promise.all([
    db.list<StoredPracticeRun>(practiceRunTable(participantId), { limit: 220 }),
    db.list<StoredPracticeRun>(legacyGameProgressTable(participantId), { limit: 220 }),
  ]);
  return dedupe([
    ...canonical.items.map(item => normalizeGameProgress(item)).filter((item): item is GameProgressRecord => !!item),
    ...legacy.items.map(item => normalizeGameProgress(item)).filter((item): item is GameProgressRecord => !!item),
  ])
    .filter(item => !options.unitId || item.unitId === options.unitId || item.originUnitId === options.unitId || item.curriculumRefs.includes(options.unitId))
    .filter(item => !options.skillId || item.skillId === options.skillId)
    .slice(0, max);
}
