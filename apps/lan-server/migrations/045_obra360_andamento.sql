-- Andamento das etapas por pavimento e checklists do Obra360: fonte única no Desktop.
-- O celular envia pela caixa de entrada; o Desktop aplica e publica de volta no catálogo.
CREATE TABLE IF NOT EXISTS obra360_andamento (
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL,
  servico TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','released','in_progress','completed','blocked')),
  checklist_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'campo' CHECK(origem IN ('campo','escritorio')),
  PRIMARY KEY(obra_id,nivel,servico)
);
