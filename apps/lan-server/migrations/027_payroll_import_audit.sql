CREATE TABLE IF NOT EXISTS importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arquivo TEXT NOT NULL,
  hash TEXT NOT NULL,
  aba TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparada',
  resumo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluida_em TEXT
);

CREATE TABLE IF NOT EXISTS importacao_linhas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
  competencia TEXT,
  celula TEXT NOT NULL,
  tipo TEXT NOT NULL,
  nome_origem TEXT,
  valor_centavos INTEGER,
  dados_brutos TEXT NOT NULL,
  entidade_tipo TEXT,
  entidade_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pendente'
);

ALTER TABLE folha_lancamentos ADD COLUMN importacao_linha_id INTEGER REFERENCES importacao_linhas(id);

CREATE INDEX IF NOT EXISTS idx_importacoes_aba_status ON importacoes(aba,status,created_at);
CREATE INDEX IF NOT EXISTS idx_importacao_linhas_importacao ON importacao_linhas(importacao_id,status);
CREATE INDEX IF NOT EXISTS idx_folha_importacao_linha ON folha_lancamentos(importacao_linha_id);
