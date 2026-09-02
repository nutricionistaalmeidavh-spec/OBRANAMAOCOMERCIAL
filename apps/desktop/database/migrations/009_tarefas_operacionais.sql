CREATE TABLE IF NOT EXISTS tarefas_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id),
  rdo_ocorrencia_id INTEGER REFERENCES rdo_ocorrencias(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel TEXT,
  prazo TEXT,
  prioridade TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tarefas_obra_status ON tarefas_obra(obra_id,status,prazo);
