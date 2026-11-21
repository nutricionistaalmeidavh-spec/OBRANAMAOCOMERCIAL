-- Registro idempotente de comandos web aplicados à fonte operacional do Desktop.
-- O D1 contém apenas a fila, nunca o registro mestre.
CREATE TABLE IF NOT EXISTS web_p0_command_receipts(
 command_id TEXT PRIMARY KEY,
 device_id TEXT NOT NULL,
 empresa_id INTEGER NOT NULL,
 obra_id INTEGER NOT NULL,
 entity TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 local_id INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_web_p0_command_receipts_obra ON web_p0_command_receipts(empresa_id,obra_id,created_at);
