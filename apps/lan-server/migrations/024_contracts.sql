CREATE TABLE IF NOT EXISTS contratos_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  cliente_id INTEGER REFERENCES clientes(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  numero TEXT,
  tipo TEXT NOT NULL DEFAULT 'principal',
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  retencao_centavos INTEGER NOT NULL DEFAULT 0 CHECK(retencao_centavos >= 0),
  garantia TEXT,
  reajuste TEXT,
  documento_principal_id INTEGER,
  data_inicio TEXT,
  data_fim TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  conta_id INTEGER REFERENCES contas(id),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS contrato_aditivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contrato_id INTEGER NOT NULL REFERENCES contratos_obra(id) ON DELETE CASCADE,
  numero TEXT,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  data TEXT,
  status TEXT NOT NULL DEFAULT 'solicitado',
  documento_id INTEGER,
  impacto_prazo_dias INTEGER NOT NULL DEFAULT 0,
  applied_at TEXT,
  request_id TEXT UNIQUE,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contratos_obra_status ON contratos_obra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_contrato_aditivos_contrato ON contrato_aditivos(contrato_id, data);
