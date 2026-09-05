CREATE TABLE IF NOT EXISTS desktop_sync_scope (
 id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL, remote_revision INTEGER NOT NULL DEFAULT 0,
 last_sync_at TEXT, last_error TEXT, snapshot TEXT, allowed_modules TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS desktop_sync_heads (
 scope_key TEXT NOT NULL, entity TEXT NOT NULL, local_id INTEGER NOT NULL,
 captured_hash TEXT NOT NULL, acknowledged_hash TEXT, remote_revision INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(scope_key,entity,local_id)
);
CREATE TABLE IF NOT EXISTS desktop_sync_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, scope_key TEXT NOT NULL,
 kind TEXT NOT NULL, entity TEXT NOT NULL, local_id INTEGER NOT NULL DEFAULT 0,
 payload TEXT NOT NULL, payload_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_desktop_sync_pending ON desktop_sync_outbox(scope_key,status,id);
CREATE TABLE IF NOT EXISTS desktop_sync_conflicts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, scope_key TEXT NOT NULL, entity TEXT NOT NULL, local_id INTEGER NOT NULL,
 remote_payload TEXT NOT NULL, remote_revision INTEGER NOT NULL, remote_conflict_id TEXT,
 status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_sync_open_conflict ON desktop_sync_conflicts(scope_key,entity,local_id) WHERE status='open';
