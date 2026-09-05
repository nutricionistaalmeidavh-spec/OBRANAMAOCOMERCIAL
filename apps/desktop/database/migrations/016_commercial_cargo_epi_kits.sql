CREATE TABLE IF NOT EXISTS cargo_epi_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cargo_id INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  epi_id INTEGER NOT NULL REFERENCES epis(id) ON DELETE CASCADE,
  quantidade_texto TEXT NOT NULL DEFAULT '01',
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, cargo_id, epi_id)
);

CREATE INDEX IF NOT EXISTS idx_cargo_epi_kits_empresa_cargo ON cargo_epi_kits(empresa_id, cargo_id, ativo);
