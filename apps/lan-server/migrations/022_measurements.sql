CREATE TABLE IF NOT EXISTS medicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  contrato_id INTEGER,
  numero TEXT NOT NULL,
  competencia TEXT NOT NULL,
  data TEXT NOT NULL,
  periodo_inicio TEXT,
  periodo_fim TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  descricao TEXT,
  retencoes_centavos INTEGER NOT NULL DEFAULT 0,
  descontos_centavos INTEGER NOT NULL DEFAULT 0,
  valor_bruto_centavos INTEGER NOT NULL DEFAULT 0,
  valor_liquido_centavos INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(obra_id, numero)
);

CREATE TABLE IF NOT EXISTS medicao_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicao_id INTEGER NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
  item_orcamentario_id INTEGER NOT NULL REFERENCES itens_orcamentarios(id),
  etapa_id INTEGER REFERENCES etapas_obra(id),
  descricao TEXT,
  unidade TEXT,
  quantidade_total REAL NOT NULL DEFAULT 0 CHECK(quantidade_total >= 0),
  quantidade_periodo REAL NOT NULL DEFAULT 0,
  quantidade_acumulada REAL NOT NULL DEFAULT 0 CHECK(quantidade_acumulada >= 0),
  valor_periodo_centavos INTEGER NOT NULL DEFAULT 0,
  justificativa_excesso TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_medicoes_obra_competencia ON medicoes(obra_id, competencia);
CREATE INDEX IF NOT EXISTS idx_medicoes_obra_frente ON medicoes(obra_id, frente_id);
CREATE INDEX IF NOT EXISTS idx_medicao_itens_medicao ON medicao_itens(medicao_id);
CREATE INDEX IF NOT EXISTS idx_medicao_mapa_obra_competencia ON medicao_mapa_itens(obra_id, competencia);
