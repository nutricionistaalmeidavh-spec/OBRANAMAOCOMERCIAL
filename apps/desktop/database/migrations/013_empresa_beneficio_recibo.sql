CREATE TABLE IF NOT EXISTS empresa_beneficio_recibo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  beneficio_id INTEGER NOT NULL REFERENCES beneficios(id) ON DELETE CASCADE,
  imprimir_recibo INTEGER NOT NULL DEFAULT 1 CHECK(imprimir_recibo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, beneficio_id)
);

CREATE INDEX IF NOT EXISTS idx_empresa_beneficio_recibo_empresa
  ON empresa_beneficio_recibo(empresa_id, beneficio_id);
