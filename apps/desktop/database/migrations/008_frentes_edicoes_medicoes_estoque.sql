CREATE TABLE IF NOT EXISTS frentes_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(obra_id, nome)
);

ALTER TABLE etapas_obra ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE cronograma_etapas ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE itens_orcamentarios ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE medicoes ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE medicoes ADD COLUMN contrato_id INTEGER REFERENCES contratos_obra(id);
ALTER TABLE contas ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE solicitacoes_compra ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE pedidos_compra ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE contratos_obra ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);

CREATE TABLE IF NOT EXISTS medicao_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicao_id INTEGER NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
  documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'comprovante',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(medicao_id, documento_id)
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

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  pedido_item_id INTEGER REFERENCES pedido_compra_itens(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','ajuste')),
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  quantidade REAL NOT NULL CHECK(quantidade > 0),
  data TEXT NOT NULL,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_frentes_obra_status ON frentes_obra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_orcamento_frente ON itens_orcamentarios(obra_id, frente_id);
CREATE INDEX IF NOT EXISTS idx_contas_frente ON contas(obra_id, frente_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_frente ON medicoes(obra_id, frente_id);
CREATE INDEX IF NOT EXISTS idx_estoque_obra_frente ON movimentacoes_estoque(obra_id, frente_id);
