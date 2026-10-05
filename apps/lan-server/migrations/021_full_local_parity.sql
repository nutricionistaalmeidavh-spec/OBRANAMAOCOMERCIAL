-- Full Desktop ↔ LAN operational parity for shared business data.
-- Local-only preferences/import-session tables intentionally stay on each Desktop.

ALTER TABLE obras ADD COLUMN tipo_obra TEXT;
ALTER TABLE obras ADD COLUMN engenheiro TEXT;
ALTER TABLE obras ADD COLUMN centro_custo TEXT;
ALTER TABLE obras ADD COLUMN status_operacional TEXT NOT NULL DEFAULT 'planejamento';

CREATE TABLE IF NOT EXISTS locais_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(obra_id, nome)
);

CREATE TABLE IF NOT EXISTS fontes_documentais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  referencia TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE itens_orcamentarios ADD COLUMN local_id INTEGER REFERENCES locais_obra(id);
ALTER TABLE itens_orcamentarios ADD COLUMN fonte_documental_id INTEGER REFERENCES fontes_documentais(id);

CREATE TABLE IF NOT EXISTS subfrentes_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER NOT NULL REFERENCES frentes_obra(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  pavimento TEXT,
  escopo TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS checklist_frente_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id INTEGER NOT NULL REFERENCES frentes_obra(id) ON DELETE CASCADE,
  subfrente_id INTEGER REFERENCES subfrentes_obra(id) ON DELETE CASCADE,
  pavimento TEXT,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'execucao',
  status TEXT NOT NULL DEFAULT 'pendente',
  responsavel TEXT,
  prazo TEXT,
  concluido_em TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS medicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  contrato_id INTEGER REFERENCES contratos_obra(id),
  numero TEXT NOT NULL,
  competencia TEXT NOT NULL,
  data TEXT NOT NULL,
  periodo_inicio TEXT,
  periodo_fim TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  descricao TEXT,
  retencoes_centavos INTEGER NOT NULL DEFAULT 0,
  descontos_centavos INTEGER NOT NULL DEFAULT 0,
  valor_bruto_centavos INTEGER NOT NULL DEFAULT 0,
  valor_liquido_centavos INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(obra_id, numero)
);

CREATE TABLE IF NOT EXISTS medicao_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicao_id INTEGER NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
  item_orcamentario_id INTEGER NOT NULL REFERENCES itens_orcamentarios(id),
  etapa_id INTEGER REFERENCES etapas_obra(id),
  descricao TEXT,
  unidade TEXT,
  quantidade_total REAL NOT NULL DEFAULT 0 CHECK(quantidade_total >= 0),
  quantidade_periodo REAL NOT NULL DEFAULT 0,
  quantidade_acumulada REAL NOT NULL DEFAULT 0 CHECK(quantidade_acumulada >= 0),
  valor_periodo_centavos INTEGER NOT NULL DEFAULT 0,
  justificativa_excesso TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicao_mapa_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  medicao_id INTEGER REFERENCES medicoes(id) ON DELETE SET NULL,
  competencia TEXT NOT NULL,
  local_nome TEXT NOT NULL,
  servico_nome TEXT NOT NULL,
  valor_periodo_centavos INTEGER NOT NULL DEFAULT 0,
  percentual_contrato REAL,
  origem_arquivo TEXT,
  origem_aba TEXT,
  origem_celula TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE contas ADD COLUMN etapa_id INTEGER REFERENCES etapas_obra(id);
ALTER TABLE contas ADD COLUMN solicitacao_compra_id INTEGER REFERENCES solicitacoes_compra(id);
ALTER TABLE contas ADD COLUMN pedido_compra_id INTEGER REFERENCES pedidos_compra(id);
ALTER TABLE contas ADD COLUMN contrato_id INTEGER REFERENCES contratos_obra(id);

CREATE TABLE IF NOT EXISTS arquivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_original TEXT NOT NULL,
  nome_armazenado TEXT NOT NULL,
  caminho TEXT NOT NULL UNIQUE,
  tamanho INTEGER NOT NULL,
  extensao TEXT,
  mime_type TEXT,
  hash TEXT,
  origem TEXT,
  importado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arquivo_id INTEGER REFERENCES arquivos(id),
  empresa_id INTEGER REFERENCES empresas(id),
  obra_id INTEGER REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  funcionario_id INTEGER REFERENCES funcionarios(id),
  conta_id INTEGER REFERENCES contas(id),
  medicao_id INTEGER REFERENCES medicoes(id),
  item_orcamentario_id INTEGER REFERENCES itens_orcamentarios(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  rdo_id INTEGER REFERENCES rdos(id),
  contrato_id INTEGER REFERENCES contratos_obra(id),
  contrato_aditivo_id INTEGER REFERENCES contrato_aditivos(id),
  pedido_compra_id INTEGER REFERENCES pedidos_compra(id),
  recebimento_material_id INTEGER REFERENCES recebimentos_materiais(id),
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status_assinatura TEXT NOT NULL DEFAULT 'geral',
  documento_origem_id INTEGER REFERENCES documentos(id),
  versao INTEGER NOT NULL DEFAULT 1,
  vencimento TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS medicao_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicao_id INTEGER NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
  documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'comprovante',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(medicao_id, documento_id)
);

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
  arquivo_origem TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chave, nome)
);

CREATE INDEX IF NOT EXISTS idx_locais_obra ON locais_obra(obra_id, nome);
CREATE INDEX IF NOT EXISTS idx_subfrentes_frente_status ON subfrentes_obra(frente_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subfrentes_unique_nome_pavimento ON subfrentes_obra(frente_id, nome, COALESCE(pavimento, '')) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_checklist_subfrente_status ON checklist_frente_itens(subfrente_id, status, prazo);
CREATE INDEX IF NOT EXISTS idx_checklist_obra_frente ON checklist_frente_itens(obra_id, frente_id, status);
CREATE INDEX IF NOT EXISTS idx_medicoes_obra_frente ON medicoes(obra_id, frente_id, competencia);
CREATE INDEX IF NOT EXISTS idx_medicao_itens_medicao ON medicao_itens(medicao_id);
CREATE INDEX IF NOT EXISTS idx_medicao_mapa_obra_competencia ON medicao_mapa_itens(obra_id, competencia);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_obra_status ON solicitacoes_compra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_obra_status ON pedidos_compra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_estoque_obra_frente ON movimentacoes_estoque(obra_id, frente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_obra_status ON contratos_obra(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_documentos_obra_frente_categoria ON documentos(obra_id, frente_id, categoria);
ALTER TABLE funcionarios ADD COLUMN cor TEXT;
ALTER TABLE funcionarios ADD COLUMN deficiencia TEXT;
ALTER TABLE funcionarios ADD COLUMN ctps_uf TEXT;
ALTER TABLE funcionarios ADD COLUMN ctps_expedicao TEXT;
ALTER TABLE funcionarios ADD COLUMN cnh_categoria TEXT;
ALTER TABLE funcionarios ADD COLUMN titulo_eleitor_zona TEXT;
ALTER TABLE funcionarios ADD COLUMN titulo_eleitor_secao TEXT;
ALTER TABLE funcionarios ADD COLUMN reservista_categoria TEXT;
ALTER TABLE funcionarios ADD COLUMN endereco_logradouro TEXT;
ALTER TABLE funcionarios ADD COLUMN endereco_numero TEXT;
ALTER TABLE funcionarios ADD COLUMN endereco_complemento TEXT;
ALTER TABLE funcionarios ADD COLUMN endereco_bairro TEXT;
ALTER TABLE funcionarios ADD COLUMN endereco_cidade TEXT;
ALTER TABLE funcionarios ADD COLUMN endereco_uf TEXT;
ALTER TABLE funcionarios ADD COLUMN matricula_esocial TEXT;
ALTER TABLE funcionarios ADD COLUMN fgts_optante INTEGER;
ALTER TABLE funcionarios ADD COLUMN fgts_opcao_em TEXT;
ALTER TABLE funcionarios ADD COLUMN beneficiarios TEXT;

CREATE INDEX IF NOT EXISTS idx_modelos_rh_chave_ativo ON modelos_documento_rh(chave, ativo);
