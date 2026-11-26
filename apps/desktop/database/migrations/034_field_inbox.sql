-- Inbox of what is born on the phone (Obra360), applied by the Desktop to its
-- canonical owners: issues become tasks; attendance and compensations wait for
-- review in the Ponto before touching any payroll data.
CREATE TABLE IF NOT EXISTS field_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remote_project_id TEXT NOT NULL,
  work_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('issue','attendance','compensation')),
  remote_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','dismissed')),
  local_table TEXT,
  local_id INTEGER,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(remote_project_id,kind,remote_key)
);
CREATE INDEX IF NOT EXISTS idx_field_inbox_pending ON field_inbox(status,kind,work_id);
