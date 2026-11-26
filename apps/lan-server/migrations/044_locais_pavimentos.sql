-- Pavimentos da obra passam a ser locais canônicos do Desktop (fonte única).
-- nivel: número do pavimento (0 = Térreo, -1 = Subsolo 1, 1 = 1º...), publicado ao celular.
ALTER TABLE locais_obra ADD COLUMN nivel INTEGER;
ALTER TABLE locais_obra ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_locais_obra_nivel ON locais_obra(obra_id,nivel) WHERE nivel IS NOT NULL;

