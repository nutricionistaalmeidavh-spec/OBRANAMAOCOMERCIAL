CREATE TABLE IF NOT EXISTS frentes_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(obra_id, nome)
);

CREATE TABLE IF NOT EXISTS rdos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
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
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  funcionario_id INTEGER,
  nome TEXT NOT NULL,
  funcao TEXT,
  horas REAL NOT NULL DEFAULT 8 CHECK(horas >= 0),
  custo_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_centavos >= 0),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdo_equipamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  horas_uso REAL NOT NULL DEFAULT 0 CHECK(horas_uso >= 0),
  custo_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_centavos >= 0),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdo_ocorrencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'outro',
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  prioridade TEXT NOT NULL DEFAULT 'normal',
  responsavel TEXT,
  prazo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdo_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  documento_id INTEGER,
  legenda TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tarefas_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id) ON DELETE SET NULL,
  rdo_ocorrencia_id INTEGER REFERENCES rdo_ocorrencias(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel TEXT,
  prazo TEXT,
  prioridade TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'aberta',
  origem_tipo TEXT NOT NULL DEFAULT 'manual',
  origem_id INTEGER,
  concluido_em TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_frentes_obra_status ON frentes_obra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_rdos_obra_data ON rdos(obra_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_rdos_obra_frente_data ON rdos(obra_id, frente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_rdo_equipe_rdo ON rdo_equipe(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_equipamentos_rdo ON rdo_equipamentos(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_ocorrencias_rdo ON rdo_ocorrencias(rdo_id, status);
CREATE INDEX IF NOT EXISTS idx_rdo_anexos_rdo ON rdo_anexos(rdo_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_obra_status ON tarefas_obra(obra_id, status, prazo);
CREATE INDEX IF NOT EXISTS idx_tarefas_origem ON tarefas_obra(origem_tipo, origem_id);
