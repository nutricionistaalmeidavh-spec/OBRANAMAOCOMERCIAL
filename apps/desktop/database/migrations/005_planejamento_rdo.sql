CREATE TABLE IF NOT EXISTS cronograma_etapas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  etapa_id INTEGER REFERENCES etapas_obra(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS rdos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  clima TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  atividades TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(obra_id, data)
);

CREATE TABLE IF NOT EXISTS rdo_equipe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
  funcionario_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  funcao TEXT,
  horas REAL NOT NULL DEFAULT 8 CHECK(horas >= 0),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdo_equipamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  horas_uso REAL NOT NULL DEFAULT 0 CHECK(horas_uso >= 0),
  custo_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_centavos >= 0),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdo_ocorrencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'outro',
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cronograma_obras ON cronograma_etapas(obra_id, previsto_inicio);
CREATE INDEX IF NOT EXISTS idx_rdos_obra_data ON rdos(obra_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_rdo_equipe_rdo ON rdo_equipe(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_ocorrencias_rdo ON rdo_ocorrencias(rdo_id, status);
