ALTER TABLE empresas ADD COLUMN politica_recibos TEXT;
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

CREATE TABLE IF NOT EXISTS fontes_documentais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  referencia TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arquivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_original TEXT NOT NULL,
  nome_armazenado TEXT NOT NULL UNIQUE,
  caminho TEXT NOT NULL UNIQUE,
  tamanho INTEGER NOT NULL CHECK(tamanho >= 0),
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

CREATE TABLE IF NOT EXISTS cargo_epi_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cargo_id INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  epi_id INTEGER NOT NULL REFERENCES epis(id) ON DELETE CASCADE,
  quantidade_texto TEXT NOT NULL DEFAULT '01',
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, cargo_id, epi_id)
);

CREATE INDEX IF NOT EXISTS idx_empresa_docs_admissao ON empresa_documentos_admissionais(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_cargo_epi_kits_empresa_cargo ON cargo_epi_kits(empresa_id, cargo_id, ativo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rdo_anexos_documento ON rdo_anexos(rdo_id, documento_id) WHERE documento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_obra_frente_categoria ON documentos(obra_id, frente_id, categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_funcionario ON documentos(funcionario_id, categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_medicao_anexos_medicao ON medicao_anexos(medicao_id);
CREATE INDEX IF NOT EXISTS idx_contrato_anexos_contrato ON contrato_anexos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_pedido_anexos_pedido ON pedido_compra_anexos(pedido_compra_id);

ALTER TABLE itens_orcamentarios ADD COLUMN fonte_documental_id INTEGER REFERENCES fontes_documentais(id);
