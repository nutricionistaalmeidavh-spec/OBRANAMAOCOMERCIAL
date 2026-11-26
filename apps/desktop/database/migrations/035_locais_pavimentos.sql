-- Pavimentos da obra passam a ser locais canônicos do Desktop (fonte única).
-- nivel: número do pavimento (0 = Térreo, -1 = Subsolo 1, 1 = 1º...), publicado ao celular.
ALTER TABLE locais_obra ADD COLUMN nivel INTEGER;
ALTER TABLE locais_obra ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_locais_obra_nivel ON locais_obra(obra_id,nivel) WHERE nivel IS NOT NULL;

-- Importação única dos pavimentos já existentes no Obra360 online para o Desktop.
CREATE TABLE IF NOT EXISTS obra360_locais_seed (
  remote_project_id TEXT NOT NULL,
  work_id INTEGER NOT NULL,
  imported INTEGER NOT NULL DEFAULT 0,
  seeded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(remote_project_id,work_id)
);
