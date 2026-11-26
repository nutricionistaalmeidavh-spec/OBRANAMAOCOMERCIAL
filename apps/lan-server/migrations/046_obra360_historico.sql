-- Histórico do Obra360 com o Desktop como dono, ligado ao RDO pela obra e data
-- (rdos é único por obra e data, então a ligação nunca é ambígua).
CREATE TABLE IF NOT EXISTS obra360_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  origem_id TEXT NOT NULL,
  nivel INTEGER,
  servico TEXT,
  data TEXT NOT NULL,
  hora TEXT,
  descricao TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'campo' CHECK(origem IN ('campo','escritorio')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(obra_id,origem_id)
);
CREATE INDEX IF NOT EXISTS idx_obra360_historico_data ON obra360_historico(obra_id,data);
