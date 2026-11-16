-- Desktop/local mode uses the same canonical RDO material ledger as the LAN server.
-- Existing receipt and manual stock movements keep request_id NULL.
ALTER TABLE movimentacoes_estoque ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimentacoes_request_id ON movimentacoes_estoque(request_id) WHERE request_id IS NOT NULL;

-- Consumo operacional do RDO: estado atual + trilha imutável das movimentações.
-- Nenhum saldo paralelo: movimentacoes_estoque continua sendo a única fonte de estoque.
CREATE TABLE IF NOT EXISTS rdo_material_linhas (
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE RESTRICT,
  linha_id TEXT NOT NULL,
  material_id TEXT,
  servico TEXT,
  frente_id INTEGER REFERENCES frentes_obra(id),
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade REAL NOT NULL CHECK(quantidade > 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rdo_id, linha_id)
);
CREATE INDEX IF NOT EXISTS idx_rdo_material_linhas_rdo ON rdo_material_linhas(rdo_id);

CREATE TABLE IF NOT EXISTS rdo_material_revisoes (
  rdo_id INTEGER PRIMARY KEY REFERENCES rdos(id) ON DELETE RESTRICT,
  revisao INTEGER NOT NULL DEFAULT 0 CHECK(revisao >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdo_material_requisicoes (
  request_id TEXT PRIMARY KEY,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE RESTRICT,
  revisao INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rdo_material_requests_rdo ON rdo_material_requisicoes(rdo_id);

CREATE TABLE IF NOT EXISTS rdo_material_efeitos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL REFERENCES rdo_material_requisicoes(request_id),
  movimentacao_id INTEGER NOT NULL UNIQUE REFERENCES movimentacoes_estoque(id) ON DELETE RESTRICT,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  delta_quantidade REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rdo_material_efeitos_rdo ON rdo_material_efeitos(rdo_id);

-- One canonical operational RDO per Web project/day; retry-safe after interruptions.
CREATE TABLE IF NOT EXISTS field_rdo_links (
  remote_project_id TEXT NOT NULL,
  day TEXT NOT NULL,
  rdo_id INTEGER NOT NULL UNIQUE REFERENCES rdos(id) ON DELETE RESTRICT,
  last_fingerprint TEXT,
  last_rdo_hash TEXT,
  last_material_revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (remote_project_id, day)
);
CREATE INDEX IF NOT EXISTS idx_field_rdo_links_rdo ON field_rdo_links(rdo_id);
