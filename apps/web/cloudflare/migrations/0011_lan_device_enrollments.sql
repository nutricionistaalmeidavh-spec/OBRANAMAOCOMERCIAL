CREATE TABLE IF NOT EXISTS lan_device_enrollments (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  server_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  cloud_device_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lan_device_enrollments_token_hash
  ON lan_device_enrollments(token_hash);

CREATE INDEX IF NOT EXISTS idx_lan_device_enrollments_server_company
  ON lan_device_enrollments(server_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lan_device_enrollments_device
  ON lan_device_enrollments(cloud_device_id, created_at DESC);
