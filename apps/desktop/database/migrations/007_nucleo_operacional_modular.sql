ALTER TABLE obras ADD COLUMN tipo_obra TEXT;
ALTER TABLE obras ADD COLUMN engenheiro TEXT;
ALTER TABLE obras ADD COLUMN centro_custo TEXT;
ALTER TABLE obras ADD COLUMN status_operacional TEXT NOT NULL DEFAULT 'planejamento';

ALTER TABLE contas ADD COLUMN etapa_id INTEGER REFERENCES etapas_obra(id);
ALTER TABLE contas ADD COLUMN solicitacao_compra_id INTEGER;
ALTER TABLE contas ADD COLUMN pedido_compra_id INTEGER;
ALTER TABLE contas ADD COLUMN contrato_id INTEGER;

CREATE TABLE IF NOT EXISTS solicitacoes_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  etapa_id INTEGER REFERENCES etapas_obra(id),
  solicitante TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prazo TEXT,
  prioridade TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'solicitada',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS cotacoes_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  fornecedor_nome TEXT,
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  prazo_entrega TEXT,
  condicoes TEXT,
  escolhida INTEGER NOT NULL DEFAULT 0,
  justificativa TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  etapa_id INTEGER REFERENCES etapas_obra(id),
  solicitacao_id INTEGER REFERENCES solicitacoes_compra(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  numero TEXT,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  entrega_prevista TEXT,
  status TEXT NOT NULL DEFAULT 'emitido',
  conta_id INTEGER REFERENCES contas(id),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS recebimentos_materiais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_compra_id INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  quantidade_pedida REAL NOT NULL DEFAULT 0,
  quantidade_recebida REAL NOT NULL DEFAULT 0,
  nota_fiscal TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contratos_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  cliente_id INTEGER REFERENCES clientes(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  numero TEXT,
  tipo TEXT NOT NULL DEFAULT 'principal',
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
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
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdo_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rdo_id INTEGER NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
  documento_id INTEGER REFERENCES documentos(id),
  legenda TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos_editaveis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  documento_id INTEGER NOT NULL UNIQUE REFERENCES documentos(id) ON DELETE CASCADE,
  conteudo_html TEXT NOT NULL,
  revisao INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modelos_documento_rh (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT NOT NULL,
  nome TEXT NOT NULL,
  conteudo_html TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chave, nome)
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_obra_status ON solicitacoes_compra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_obra_status ON pedidos_compra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_contratos_obra_status ON contratos_obra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_contas_obra_etapa ON contas(obra_id, etapa_id);
CREATE INDEX IF NOT EXISTS idx_modelos_rh_chave_ativo ON modelos_documento_rh(chave, ativo);
