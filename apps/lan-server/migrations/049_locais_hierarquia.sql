-- Locais da obra em cadeia: pavimento (com nível) → complementos (guarita, apto, banheiro…).
-- Um único cadastro canônico; "fica em" é opcional e o vínculo de pendências e ocorrências também.
ALTER TABLE locais_obra ADD COLUMN local_pai_id INTEGER REFERENCES locais_obra(id);
CREATE INDEX IF NOT EXISTS idx_locais_obra_pai ON locais_obra(local_pai_id);
ALTER TABLE tarefas_obra ADD COLUMN local_id INTEGER REFERENCES locais_obra(id);
CREATE INDEX IF NOT EXISTS idx_tarefas_obra_local ON tarefas_obra(local_id);
ALTER TABLE rdo_ocorrencias ADD COLUMN local_id INTEGER REFERENCES locais_obra(id);
CREATE INDEX IF NOT EXISTS idx_rdo_ocorrencias_local ON rdo_ocorrencias(local_id);
