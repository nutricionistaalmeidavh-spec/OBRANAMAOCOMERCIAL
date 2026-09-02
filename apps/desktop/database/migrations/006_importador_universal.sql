CREATE TABLE IF NOT EXISTS perfis_importacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  area TEXT NOT NULL,
  aba TEXT,
  mapeamento_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nome, area)
);

CREATE INDEX IF NOT EXISTS idx_perfis_importacao_area ON perfis_importacao(area);
