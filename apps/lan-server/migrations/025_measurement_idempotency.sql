ALTER TABLE medicoes ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_medicoes_request_id ON medicoes(request_id) WHERE request_id IS NOT NULL;
