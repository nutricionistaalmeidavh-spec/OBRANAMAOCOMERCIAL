-- Cadastro de notas fiscais RECEBIDAS: registro documental, sem emissão fiscal.
-- Importante: não cria contas, pagamentos nem movimentações de estoque.
CREATE TABLE IF NOT EXISTS notas_recebidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  numero TEXT NOT NULL,
  serie TEXT NOT NULL DEFAULT '',
  emissao TEXT NOT NULL,
  data_recebimento TEXT,
  valor_total_centavos INTEGER NOT NULL CHECK(valor_total_centavos > 0),
  pedido_compra_id INTEGER REFERENCES pedidos_compra(id),
  conta_id INTEGER REFERENCES contas(id),
  documento_id INTEGER REFERENCES documentos(id),
  observacoes TEXT,
  request_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nota_recebida_identidade ON notas_recebidas(empresa_id,fornecedor_id,numero,serie) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notas_recebidas_obra ON notas_recebidas(obra_id,emissao DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_notas_recebidas_pedido ON notas_recebidas(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_notas_recebidas_conta ON notas_recebidas(conta_id);
CREATE TABLE IF NOT EXISTS nota_recebida_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nota_id INTEGER NOT NULL REFERENCES notas_recebidas(id) ON DELETE CASCADE,
  frente_id INTEGER REFERENCES frentes_obra(id),
  subfrente_id INTEGER REFERENCES subfrentes_obra(id),
  pedido_item_id INTEGER REFERENCES pedido_compra_itens(id),
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  quantidade REAL NOT NULL CHECK(quantidade > 0),
  valor_unitario_centavos INTEGER NOT NULL CHECK(valor_unitario_centavos >= 0),
  valor_total_centavos INTEGER NOT NULL CHECK(valor_total_centavos >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nota_recebida_itens_nota ON nota_recebida_itens(nota_id,id);
CREATE INDEX IF NOT EXISTS idx_nota_recebida_itens_etapa ON nota_recebida_itens(frente_id,subfrente_id);
