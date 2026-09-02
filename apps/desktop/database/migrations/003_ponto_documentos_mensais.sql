CREATE TABLE IF NOT EXISTS pontos_mensais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  competencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  preenchimento_automatico INTEGER NOT NULL DEFAULT 0,
  jornada_inicio TEXT NOT NULL DEFAULT '07:00',
  intervalo_inicio TEXT NOT NULL DEFAULT '11:00',
  intervalo_fim TEXT NOT NULL DEFAULT '12:00',
  jornada_fim TEXT NOT NULL DEFAULT '17:00',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(funcionario_id, competencia)
);

CREATE TABLE IF NOT EXISTS ponto_marcacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ponto_mensal_id INTEGER NOT NULL REFERENCES pontos_mensais(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'trabalho',
  entrada TEXT,
  intervalo_saida TEXT,
  intervalo_entrada TEXT,
  saida TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ponto_mensal_id, data)
);

CREATE INDEX IF NOT EXISTS idx_pontos_funcionario_competencia ON pontos_mensais(funcionario_id, competencia);
CREATE INDEX IF NOT EXISTS idx_ponto_marcacoes_ponto_data ON ponto_marcacoes(ponto_mensal_id, data);
