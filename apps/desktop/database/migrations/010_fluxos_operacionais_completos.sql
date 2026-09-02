ALTER TABLE rdos ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE rdo_equipe ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE rdo_equipe ADD COLUMN custo_centavos INTEGER NOT NULL DEFAULT 0 CHECK(custo_centavos >= 0);
ALTER TABLE rdo_equipamentos ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE rdo_ocorrencias ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE rdo_ocorrencias ADD COLUMN prioridade TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE rdo_ocorrencias ADD COLUMN responsavel TEXT;
ALTER TABLE rdo_ocorrencias ADD COLUMN prazo TEXT;
ALTER TABLE rdo_anexos ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);

ALTER TABLE tarefas_obra ADD COLUMN origem_tipo TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE tarefas_obra ADD COLUMN origem_id INTEGER;
ALTER TABLE tarefas_obra ADD COLUMN concluido_em TEXT;

ALTER TABLE medicao_itens ADD COLUMN etapa_id INTEGER REFERENCES etapas_obra(id);
ALTER TABLE medicao_itens ADD COLUMN descricao TEXT;
ALTER TABLE medicao_itens ADD COLUMN unidade TEXT;
ALTER TABLE medicao_itens ADD COLUMN quantidade_total REAL NOT NULL DEFAULT 0 CHECK(quantidade_total >= 0);
ALTER TABLE medicao_itens ADD COLUMN quantidade_acumulada REAL NOT NULL DEFAULT 0 CHECK(quantidade_acumulada >= 0);

ALTER TABLE solicitacoes_compra ADD COLUMN cotacao_escolhida_id INTEGER REFERENCES cotacoes_compra(id);
ALTER TABLE cotacoes_compra ADD COLUMN status TEXT NOT NULL DEFAULT 'recebida';
ALTER TABLE pedidos_compra ADD COLUMN cotacao_id INTEGER REFERENCES cotacoes_compra(id);
ALTER TABLE recebimentos_materiais ADD COLUMN pedido_item_id INTEGER REFERENCES pedido_compra_itens(id);
ALTER TABLE recebimentos_materiais ADD COLUMN obra_id INTEGER REFERENCES obras(id);
ALTER TABLE recebimentos_materiais ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE recebimentos_materiais ADD COLUMN documento_id INTEGER REFERENCES documentos(id);
ALTER TABLE movimentacoes_estoque ADD COLUMN documento_id INTEGER REFERENCES documentos(id);

ALTER TABLE contratos_obra ADD COLUMN retencao_centavos INTEGER NOT NULL DEFAULT 0 CHECK(retencao_centavos >= 0);
ALTER TABLE contratos_obra ADD COLUMN garantia TEXT;
ALTER TABLE contratos_obra ADD COLUMN reajuste TEXT;
ALTER TABLE contratos_obra ADD COLUMN documento_principal_id INTEGER REFERENCES documentos(id);
ALTER TABLE contrato_aditivos ADD COLUMN documento_id INTEGER REFERENCES documentos(id);
ALTER TABLE contrato_aditivos ADD COLUMN impacto_prazo_dias INTEGER NOT NULL DEFAULT 0;

ALTER TABLE documentos ADD COLUMN frente_id INTEGER REFERENCES frentes_obra(id);
ALTER TABLE documentos ADD COLUMN rdo_id INTEGER REFERENCES rdos(id);
ALTER TABLE documentos ADD COLUMN contrato_id INTEGER REFERENCES contratos_obra(id);
ALTER TABLE documentos ADD COLUMN contrato_aditivo_id INTEGER REFERENCES contrato_aditivos(id);
ALTER TABLE documentos ADD COLUMN pedido_compra_id INTEGER REFERENCES pedidos_compra(id);
ALTER TABLE documentos ADD COLUMN recebimento_material_id INTEGER REFERENCES recebimentos_materiais(id);
ALTER TABLE documentos ADD COLUMN vencimento TEXT;

CREATE TABLE IF NOT EXISTS contrato_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contrato_id INTEGER NOT NULL REFERENCES contratos_obra(id) ON DELETE CASCADE,
  documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'contrato',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contrato_id, documento_id)
);

CREATE TABLE IF NOT EXISTS pedido_compra_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_compra_id INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'nota',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pedido_compra_id, documento_id)
);

CREATE INDEX IF NOT EXISTS idx_rdos_obra_frente_data ON rdos(obra_id, frente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_tarefas_origem ON tarefas_obra(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_documentos_obra_frente_categoria ON documentos(obra_id, frente_id, categoria);
CREATE INDEX IF NOT EXISTS idx_contrato_anexos_contrato ON contrato_anexos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_pedido_anexos_pedido ON pedido_compra_anexos(pedido_compra_id);
