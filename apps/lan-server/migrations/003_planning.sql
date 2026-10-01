CREATE TABLE IF NOT EXISTS etapas_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(obra_id, nome)
);

CREATE TABLE IF NOT EXISTS cronograma_etapas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  etapa_id INTEGER REFERENCES etapas_obra(id) ON DELETE SET NULL,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  responsavel TEXT,
  previsto_inicio TEXT,
  previsto_fim TEXT,
  percentual_previsto REAL NOT NULL DEFAULT 0 CHECK(percentual_previsto BETWEEN 0 AND 100),
  percentual_realizado REAL NOT NULL DEFAULT 0 CHECK(percentual_realizado BETWEEN 0 AND 100),
  custo_planejado_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_planejado_centavos >= 0),
  custo_realizado_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_realizado_centavos >= 0),
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS itens_orcamentarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  etapa_id INTEGER REFERENCES etapas_obra(id) ON DELETE SET NULL,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  codigo TEXT,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0 CHECK(quantidade >= 0),
  valor_unitario_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_unitario_centavos >= 0),
  tipo TEXT NOT NULL CHECK(tipo IN ('material','mao_de_obra','equipamento','servico')),
  observacoes TEXT,
  atualizado_em TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_etapas_obra_frente ON etapas_obra(obra_id, frente_id, ordem);
CREATE INDEX IF NOT EXISTS idx_cronograma_obra_frente ON cronograma_etapas(obra_id, frente_id, previsto_inicio);
CREATE INDEX IF NOT EXISTS idx_orcamento_obra_frente ON itens_orcamentarios(obra_id, frente_id, etapa_id);
