-- Preserva contas existentes: classificação é opcional e pode ser feita após importação.
ALTER TABLE contas ADD COLUMN subfrente_id INTEGER REFERENCES subfrentes_obra(id);
CREATE INDEX IF NOT EXISTS idx_contas_obra_etapa_subetapa ON contas(obra_id,frente_id,subfrente_id,tipo,status,competencia);

-- A etapa e a subetapa devem pertencer sempre à mesma obra da conta.
CREATE TRIGGER IF NOT EXISTS trg_conta_classificacao_insert BEFORE INSERT ON contas
WHEN NEW.frente_id IS NOT NULL OR NEW.subfrente_id IS NOT NULL
BEGIN
 SELECT CASE WHEN NEW.obra_id IS NULL OR NEW.frente_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM frentes_obra f WHERE f.id=NEW.frente_id AND f.obra_id=NEW.obra_id AND f.deleted_at IS NULL
 ) THEN RAISE(ABORT,'Etapa deve pertencer à obra da conta.') END;
 SELECT CASE WHEN NEW.subfrente_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM subfrentes_obra s
   WHERE s.id=NEW.subfrente_id AND s.frente_id=NEW.frente_id AND s.obra_id=NEW.obra_id AND s.deleted_at IS NULL
 ) THEN RAISE(ABORT,'Subetapa deve pertencer à etapa e à obra da conta.') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_conta_classificacao_update BEFORE UPDATE OF obra_id,frente_id,subfrente_id ON contas
WHEN NEW.frente_id IS NOT NULL OR NEW.subfrente_id IS NOT NULL
BEGIN
 SELECT CASE WHEN NEW.obra_id IS NULL OR NEW.frente_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM frentes_obra f WHERE f.id=NEW.frente_id AND f.obra_id=NEW.obra_id AND f.deleted_at IS NULL
 ) THEN RAISE(ABORT,'Etapa deve pertencer à obra da conta.') END;
 SELECT CASE WHEN NEW.subfrente_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM subfrentes_obra s
   WHERE s.id=NEW.subfrente_id AND s.frente_id=NEW.frente_id AND s.obra_id=NEW.obra_id AND s.deleted_at IS NULL
 ) THEN RAISE(ABORT,'Subetapa deve pertencer à etapa e à obra da conta.') END;
END;

CREATE TABLE IF NOT EXISTS nota_recebida_revisoes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 nota_id INTEGER NOT NULL REFERENCES notas_recebidas(id),
 anterior_json TEXT NOT NULL,
 atual_json TEXT NOT NULL,
 alterado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nota_revisoes_nota ON nota_recebida_revisoes(nota_id,id DESC);
