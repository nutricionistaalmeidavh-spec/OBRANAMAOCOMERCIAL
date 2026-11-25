-- Multiobra: each additional local work synchronizes with its own online project.
-- The primary work stays in desktop_sync_scope (id=1) for compatibility.
CREATE TABLE IF NOT EXISTS desktop_sync_extra_scopes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remote_project_id TEXT NOT NULL UNIQUE,
  work_id INTEGER NOT NULL UNIQUE,
  binding TEXT NOT NULL,
  remote_revision INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  last_error TEXT,
  snapshot TEXT,
  allowed_modules TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS desktop_sync_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Works created by spreadsheet import are never published automatically: a typo
-- in a sheet must not become an online project. The office publishes them once.
CREATE TABLE IF NOT EXISTS desktop_sync_skip_auto (
  work_id INTEGER PRIMARY KEY
);
