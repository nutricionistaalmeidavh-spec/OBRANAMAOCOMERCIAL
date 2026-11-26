-- Atividade/equipe do RDO ligada (opcionalmente) a um local canônico da obra.
ALTER TABLE rdo_equipe ADD COLUMN local_id INTEGER REFERENCES locais_obra(id);
CREATE INDEX IF NOT EXISTS idx_rdo_equipe_local ON rdo_equipe(local_id);
