-- Caixa de entrada do celular (Obra360) também no servidor (LAN ou servidor próprio).
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

CREATE TABLE IF NOT EXISTS obra360_locais_seed (
  remote_project_id TEXT NOT NULL,
  work_id INTEGER NOT NULL,
  imported INTEGER NOT NULL DEFAULT 0,
  seeded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(remote_project_id,work_id)
);
