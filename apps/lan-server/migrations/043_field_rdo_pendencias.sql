-- Field RDO follow-ups that need the office, without blocking the diary itself.
-- kind='material': consumption sent by the phone could not be applied (stock).
-- The RDO, crew and photos are imported; the desired lines wait here until applied.
CREATE TABLE IF NOT EXISTS field_rdo_pendencias (
  id INTEGER PRIMARY KEY,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK(kind IN ('material')),
  request_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolution TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_rdo_pendencias_open ON field_rdo_pendencias(rdo_id,kind) WHERE resolved_at IS NULL;

-- A phone diary may be attached to an RDO typed in the office for the same day.
-- The office text and material lines are kept as the base of the merged diary.
ALTER TABLE field_rdo_links ADD COLUMN manual_merge INTEGER NOT NULL DEFAULT 0;
ALTER TABLE field_rdo_links ADD COLUMN base_atividades TEXT;
ALTER TABLE field_rdo_links ADD COLUMN base_observacoes TEXT;
ALTER TABLE field_rdo_links ADD COLUMN base_materiais_json TEXT;
