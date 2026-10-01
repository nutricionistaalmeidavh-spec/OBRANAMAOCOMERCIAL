CREATE TABLE IF NOT EXISTS module_migrations (
  migration_id TEXT PRIMARY KEY,
  module TEXT NOT NULL CHECK(module IN ('core','operation','planning','finance','rh')),
  source_fingerprint TEXT NOT NULL,
  expected_counts_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK(status IN ('started','validated','committed','rolled_back','failed')),
  created_at TEXT NOT NULL,
  validated_at TEXT,
  committed_at TEXT,
  rolled_back_at TEXT
);

CREATE TABLE IF NOT EXISTS module_migration_records (
  migration_id TEXT NOT NULL REFERENCES module_migrations(migration_id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  created_target INTEGER NOT NULL DEFAULT 1 CHECK(created_target IN (0,1)),
  source_data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  PRIMARY KEY(migration_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_module_migrations_source
  ON module_migrations(source_fingerprint, module, status);

CREATE INDEX IF NOT EXISTS idx_module_migration_records_target
  ON module_migration_records(target_table, target_id);

CREATE INDEX IF NOT EXISTS idx_module_migration_records_source
  ON module_migration_records(source_table, source_id, migration_id);
