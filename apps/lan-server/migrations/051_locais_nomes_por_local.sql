-- migration:foreign-keys-off
-- Nomes de locais passam a ser únicos entre irmãos (mesmo local de cima), não na obra inteira:
-- "Sala" pode existir no Apto 101 e no Apto 102. Reconstrução da tabela preservando ids e dados;
-- o executor desliga as chaves estrangeiras só durante esta migration e confere a integridade antes do commit.
CREATE TABLE locais_obra_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  nivel INTEGER,
  ordem INTEGER NOT NULL DEFAULT 0,
  local_pai_id INTEGER REFERENCES locais_obra(id)
);
INSERT INTO locais_obra_v2(id,obra_id,nome,tipo,created_at,updated_at,nivel,ordem,local_pai_id)
  SELECT id,obra_id,nome,tipo,created_at,updated_at,nivel,ordem,local_pai_id FROM locais_obra;
DROP TABLE locais_obra;
ALTER TABLE locais_obra_v2 RENAME TO locais_obra;
CREATE INDEX IF NOT EXISTS idx_locais_obra ON locais_obra(obra_id, nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locais_obra_nivel ON locais_obra(obra_id,nivel) WHERE nivel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locais_obra_pai ON locais_obra(local_pai_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locais_obra_irmaos ON locais_obra(obra_id, COALESCE(local_pai_id, 0), nome);
