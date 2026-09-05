CREATE TABLE IF NOT EXISTS empresa_documentos_admissionais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  documento_key TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  obrigatorio INTEGER NOT NULL DEFAULT 0,
  modelo_id TEXT,
  titulo_customizado TEXT,
  configuracao_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, documento_key)
);

CREATE INDEX IF NOT EXISTS idx_empresa_docs_admissao ON empresa_documentos_admissionais(empresa_id, ativo);

INSERT INTO configuracoes(chave, valor, updated_at)
VALUES ('commercial_admission_docs_version', '2', CURRENT_TIMESTAMP)
ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP;
