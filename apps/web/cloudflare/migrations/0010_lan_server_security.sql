CREATE TABLE IF NOT EXISTS lan_server_claims (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  server_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  issued_by_device_id TEXT NOT NULL,
  issued_by_member_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lan_server_claims_token_hash ON lan_server_claims(token_hash);
CREATE INDEX IF NOT EXISTS idx_lan_server_claims_server_company ON lan_server_claims(server_id, company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lan_server_grants (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  server_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  claiming_member_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_lan_server_grants_token_hash ON lan_server_grants(token_hash);
CREATE INDEX IF NOT EXISTS idx_lan_server_grants_server_company ON lan_server_grants(server_id, company_id, created_at DESC);
