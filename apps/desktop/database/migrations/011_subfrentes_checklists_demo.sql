CREATE TABLE IF NOT EXISTS subfrentes_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER NOT NULL REFERENCES frentes_obra(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  pavimento TEXT,
  escopo TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS checklist_frente_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER NOT NULL REFERENCES frentes_obra(id) ON DELETE CASCADE,
  subfrente_id INTEGER REFERENCES subfrentes_obra(id) ON DELETE CASCADE,
  pavimento TEXT,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'execucao',
  status TEXT NOT NULL DEFAULT 'pendente',
  responsavel TEXT,
  prazo TEXT,
  concluido_em TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subfrentes_frente_status ON subfrentes_obra(frente_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subfrentes_unique_nome_pavimento ON subfrentes_obra(frente_id, nome, COALESCE(pavimento, '')) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_checklist_subfrente_status ON checklist_frente_itens(subfrente_id, status, prazo);
CREATE INDEX IF NOT EXISTS idx_checklist_obra_frente ON checklist_frente_itens(obra_id, frente_id, status);
