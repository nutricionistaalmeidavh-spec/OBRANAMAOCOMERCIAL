import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, API_CONTRACT_VERSION, DB_SCHEMA_VERSION, PROJECT_STATE_VERSION } from '../shared/version';
import { assessSchemaState, REQUIRED_SCHEMA_MIGRATIONS, REQUIRED_SCHEMA_TABLES } from '../cloudflare/sdk';
import { AREAS, CONTENT, QUESTION_BANK, QUESTION_COVERAGE, T, selectQuestions } from '../src/curriculum';

describe('P2 maintenance boundaries', () => {
  it('keeps explicit application and schema versions', () => {
    expect(APP_VERSION).toBe('0.2.0');
    expect(API_CONTRACT_VERSION).toBeGreaterThanOrEqual(3);
    expect(DB_SCHEMA_VERSION).toBe(6);
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

  it('tracks database schema version in forward migrations', () => {
    const v2 = readFileSync(resolve(process.cwd(), 'cloudflare/migrations/0002_versioning_observability.sql'), 'utf8');
    const hardening = readFileSync(resolve(process.cwd(), 'cloudflare/migrations/0003_schema_contract_hardening.sql'), 'utf8');
    for (const sql of [v2, hardening]) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_metadata');
      expect(sql).toContain("VALUES('schema_version','2'");
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS api_error_log');
    }
  });

  it('does not report schema ready from code constants alone', () => {
    const ready = assessSchemaState({
      tableNames: REQUIRED_SCHEMA_TABLES,
      persistedSchemaVersion: DB_SCHEMA_VERSION,
      appliedMigrations: REQUIRED_SCHEMA_MIGRATIONS,
    });
    expect(ready.schemaReady).toBe(true);
    expect(ready.persistedDbSchemaVersion).toBe(DB_SCHEMA_VERSION);

    const stale = assessSchemaState({
      tableNames: REQUIRED_SCHEMA_TABLES,
      persistedSchemaVersion: 1,
      appliedMigrations: REQUIRED_SCHEMA_MIGRATIONS,
    });
    expect(stale.schemaReady).toBe(false);
    expect(stale.schemaVersionMatch).toBe(false);

    const missingMigration = assessSchemaState({
      tableNames: REQUIRED_SCHEMA_TABLES,
      persistedSchemaVersion: DB_SCHEMA_VERSION,
      appliedMigrations: ['0002_versioning_observability.sql'],
    });
    expect(missingMigration.schemaReady).toBe(true);
    expect(missingMigration.migrationTrackingReady).toBe(false);
    expect(missingMigration.missingRequiredMigrations).toContain('0003_schema_contract_hardening.sql');

    const missingTable = assessSchemaState({
      tableNames: REQUIRED_SCHEMA_TABLES.filter(name => name !== 'schema_metadata'),
      persistedSchemaVersion: DB_SCHEMA_VERSION,
      appliedMigrations: REQUIRED_SCHEMA_MIGRATIONS,
    });
    expect(missingTable.schemaReady).toBe(false);
    expect(missingTable.missingSchemaTables).toContain('schema_metadata');
  });
});
