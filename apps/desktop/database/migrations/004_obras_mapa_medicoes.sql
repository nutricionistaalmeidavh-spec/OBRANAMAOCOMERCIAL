CREATE TABLE IF NOT EXISTS medicao_mapa_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  medicao_id INTEGER REFERENCES medicoes(id) ON DELETE SET NULL,
  competencia TEXT NOT NULL,
  local_nome TEXT NOT NULL,
  servico_nome TEXT NOT NULL,
  valor_periodo_centavos INTEGER NOT NULL DEFAULT 0,
  percentual_contrato REAL,
  origem_arquivo TEXT,
  origem_aba TEXT,
  origem_celula TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_medicao_mapa_obra_competencia ON medicao_mapa_itens(obra_id, competencia);
CREATE INDEX IF NOT EXISTS idx_medicao_mapa_medicao ON medicao_mapa_itens(medicao_id);
