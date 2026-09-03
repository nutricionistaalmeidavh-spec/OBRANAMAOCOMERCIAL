CREATE TABLE IF NOT EXISTS schema_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO schema_metadata(key,value,updated_at)
VALUES('schema_version','2',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

CREATE TABLE IF NOT EXISTS api_error_log (
  request_id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_error_log_created ON api_error_log(created_at DESC);
