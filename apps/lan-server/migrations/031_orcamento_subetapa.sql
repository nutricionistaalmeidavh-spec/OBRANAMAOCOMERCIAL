-- P2: vínculo OPCIONAL do orçamento existente à subetapa canônica.
-- Dados antigos continuam com subfrente_id NULL, sem redistribuição fictícia.
ALTER TABLE itens_orcamentarios ADD COLUMN subfrente_id INTEGER REFERENCES subfrentes_obra(id);
CREATE INDEX IF NOT EXISTS idx_orcamento_etapa_subetapa
  ON itens_orcamentarios(obra_id,frente_id,subfrente_id);

CREATE TRIGGER IF NOT EXISTS trg_orcamento_subetapa_ins
BEFORE INSERT ON itens_orcamentarios
WHEN NEW.subfrente_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM subfrentes_obra s
    WHERE s.id=NEW.subfrente_id AND s.obra_id=NEW.obra_id
      AND s.frente_id=NEW.frente_id AND s.deleted_at IS NULL
  ) THEN RAISE(ABORT,'Subetapa deve pertencer à etapa e à mesma obra.') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_orcamento_subetapa_upd
BEFORE UPDATE OF subfrente_id,frente_id,obra_id ON itens_orcamentarios
WHEN NEW.subfrente_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM subfrentes_obra s
    WHERE s.id=NEW.subfrente_id AND s.obra_id=NEW.obra_id
      AND s.frente_id=NEW.frente_id AND s.deleted_at IS NULL
  ) THEN RAISE(ABORT,'Subetapa deve pertencer à etapa e à mesma obra.') END;
END;
