ALTER TABLE contas ADD COLUMN etapa_id INTEGER REFERENCES etapas_obra(id);
ALTER TABLE contas ADD COLUMN solicitacao_compra_id INTEGER;
ALTER TABLE contas ADD COLUMN pedido_compra_id INTEGER;
ALTER TABLE contas ADD COLUMN contrato_id INTEGER;

CREATE TABLE IF NOT EXISTS solicitacoes_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  etapa_id INTEGER REFERENCES etapas_obra(id),
  cotacao_escolhida_id INTEGER,
  solicitante TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prazo TEXT,
  prioridade TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'solicitada',
  observacoes TEXT,
  request_id TEXT UNIQUE,
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
  escolhida INTEGER NOT NULL DEFAULT 0 CHECK(escolhida IN (0,1)),
  justificativa TEXT,
  status TEXT NOT NULL DEFAULT 'recebida',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  etapa_id INTEGER REFERENCES etapas_obra(id),
  solicitacao_id INTEGER REFERENCES solicitacoes_compra(id),
  cotacao_id INTEGER REFERENCES cotacoes_compra(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  numero TEXT,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  entrega_prevista TEXT,
  status TEXT NOT NULL DEFAULT 'emitido',
  conta_id INTEGER REFERENCES contas(id),
  request_id TEXT UNIQUE,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS pedido_compra_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_compra_id INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  quantidade_pedida REAL NOT NULL DEFAULT 0 CHECK(quantidade_pedida >= 0),
  quantidade_recebida REAL NOT NULL DEFAULT 0 CHECK(quantidade_recebida >= 0),
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recebimentos_materiais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_compra_id INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  pedido_item_id INTEGER REFERENCES pedido_compra_itens(id),
  obra_id INTEGER REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  documento_id INTEGER,
  data TEXT NOT NULL,
  quantidade_pedida REAL NOT NULL DEFAULT 0,
  quantidade_recebida REAL NOT NULL DEFAULT 0,
  nota_fiscal TEXT,
  observacoes TEXT,
  request_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  pedido_item_id INTEGER REFERENCES pedido_compra_itens(id),
  documento_id INTEGER,
  tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','ajuste')),
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  quantidade REAL NOT NULL CHECK(quantidade > 0),
  data TEXT NOT NULL,
  observacoes TEXT,
  request_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_obra_status ON solicitacoes_compra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_obra_status ON pedidos_compra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_compra_itens(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_pedido ON recebimentos_materiais(pedido_compra_id, data);
CREATE INDEX IF NOT EXISTS idx_estoque_obra_frente ON movimentacoes_estoque(obra_id, frente_id);
CREATE INDEX IF NOT EXISTS idx_contas_obra_etapa ON contas(obra_id, etapa_id);
