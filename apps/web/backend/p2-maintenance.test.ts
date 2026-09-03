import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, API_CONTRACT_VERSION, DB_SCHEMA_VERSION, PROJECT_STATE_VERSION } from '../shared/version';
import { AREAS, CONTENT, QUESTION_BANK, QUESTION_COVERAGE, T, selectQuestions } from '../src/curriculum';

describe('P2 maintenance boundaries', () => {
  it('keeps explicit application and schema versions', () => {
    expect(APP_VERSION).toBe('0.2.0');
    expect(API_CONTRACT_VERSION).toBeGreaterThanOrEqual(3);
    expect(DB_SCHEMA_VERSION).toBe(2);
    expect(PROJECT_STATE_VERSION).toBeGreaterThanOrEqual(7);
  });

  it('keeps curriculum catalog, content and question banks aligned after the split', () => {
    expect(T).toHaveLength(12);
    expect(AREAS).toHaveLength(3);
    expect(Object.keys(CONTENT)).toHaveLength(60);
    expect(Object.keys(QUESTION_BANK)).toHaveLength(60);
    expect(Object.keys(QUESTION_COVERAGE)).toHaveLength(60);
    expect(Object.values(QUESTION_COVERAGE).every(item => item.ok)).toBe(true);

    for (const [unitId, unit] of Object.entries(CONTENT)) {
      expect(unit.items.length).toBeGreaterThanOrEqual(1);
      const selected = selectQuestions(unitId, unit.items, 20260903, 13);
      expect(selected).toHaveLength(13);
      expect(new Set(selected.map(item => item.meta?.id)).size).toBe(13);
    }
  });

  it('tracks database schema version in a forward migration', () => {
    const file = resolve(process.cwd(), 'cloudflare/migrations/0002_versioning_observability.sql');
    const sql = readFileSync(file, 'utf8');
    expect(sql).toContain("VALUES('schema_version','2'");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS api_error_log');
  });
});
