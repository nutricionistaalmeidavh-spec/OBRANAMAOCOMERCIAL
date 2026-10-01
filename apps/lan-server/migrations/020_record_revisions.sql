CREATE TABLE IF NOT EXISTS record_revisions (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_record_revisions_updated_at
  ON record_revisions(updated_at);
