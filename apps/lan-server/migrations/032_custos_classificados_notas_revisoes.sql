-- Classificação de despesas já existentes, sem reimportação, e revisão de notas recebidas.
ALTER TABLE contas ADD COLUMN subfrente_id INTEGER REFERENCES subfrentes_obra(id);
CREATE INDEX IF NOT EXISTS idx_contas_obra_etapa_subetapa ON contas(obra_id,frente_id,subfrente_id,tipo,deleted_at);

CREATE TRIGGER IF NOT EXISTS trg_contas_etapa_subetapa_insert
BEFORE INSERT ON contas WHEN NEW.subfrente_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM subfrentes_obra s
    WHERE s.id=NEW.subfrente_id AND s.frente_id=NEW.frente_id AND s.obra_id=NEW.obra_id AND s.deleted_at IS NULL
  ) THEN RAISE(ABORT,'Subetapa deve pertencer à etapa e à mesma obra.') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_contas_etapa_subetapa_update
BEFORE UPDATE OF frente_id,subfrente_id,obra_id ON contas WHEN NEW.subfrente_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM subfrentes_obra s
    WHERE s.id=NEW.subfrente_id AND s.frente_id=NEW.frente_id AND s.obra_id=NEW.obra_id AND s.deleted_at IS NULL
  ) THEN RAISE(ABORT,'Subetapa deve pertencer à etapa e à mesma obra.') END;
END;

CREATE TABLE IF NOT EXISTS custos_classificacoes_historico(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL REFERENCES contas(id),
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_anterior_id INTEGER,
  subfrente_anterior_id INTEGER,
  frente_nova_id INTEGER,
  subfrente_nova_id INTEGER,
  origem TEXT NOT NULL DEFAULT 'classificacao_em_lote',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_custos_classificacoes_historico_conta ON custos_classificacoes_historico(conta_id,id DESC);

ALTER TABLE notas_recebidas ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS nota_recebida_revisoes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nota_id INTEGER NOT NULL REFERENCES notas_recebidas(id),
  revision_anterior INTEGER NOT NULL,
  anterior_json TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'edicao_usuario',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nota_recebida_revisoes_nota ON nota_recebida_revisoes(nota_id,id DESC);
