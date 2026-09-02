CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','inativa')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS fornecedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS obras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  cliente_id INTEGER REFERENCES clientes(id),
  nome TEXT NOT NULL,
  codigo TEXT,
  endereco TEXT,
  responsavel TEXT,
  valor_contratado_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_contratado_centavos >= 0),
  data_inicio TEXT,
  previsao_termino TEXT,
  status TEXT NOT NULL DEFAULT 'planejada',
  percentual_fisico REAL NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS etapas_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(obra_id, nome)
);

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

CREATE TABLE IF NOT EXISTS itens_orcamentarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  etapa_id INTEGER REFERENCES etapas_obra(id),
  local_id INTEGER REFERENCES locais_obra(id),
  fonte_documental_id INTEGER REFERENCES fontes_documentais(id),
  codigo TEXT,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0 CHECK(quantidade >= 0),
  valor_unitario_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_unitario_centavos >= 0),
  tipo TEXT NOT NULL CHECK(tipo IN ('material','mao_de_obra','equipamento','servico')),
  observacoes TEXT,
  atualizado_em TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS medicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL REFERENCES obras(id),
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
  quantidade_periodo REAL NOT NULL DEFAULT 0,
  valor_periodo_centavos INTEGER NOT NULL DEFAULT 0,
  justificativa_excesso TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias_financeiras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  natureza TEXT NOT NULL CHECK(natureza IN ('receita','despesa')),
  grupo_dre TEXT NOT NULL DEFAULT 'operacional',
  ativa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK(tipo IN ('pagar','receber')),
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  obra_id INTEGER REFERENCES obras(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  cliente_id INTEGER REFERENCES clientes(id),
  categoria_id INTEGER REFERENCES categorias_financeiras(id),
  medicao_id INTEGER REFERENCES medicoes(id),
  descricao TEXT NOT NULL,
  competencia TEXT NOT NULL,
  emissao TEXT,
  vencimento TEXT NOT NULL,
  valor_bruto_centavos INTEGER NOT NULL DEFAULT 0,
  retencoes_centavos INTEGER NOT NULL DEFAULT 0,
  descontos_centavos INTEGER NOT NULL DEFAULT 0,
  valor_centavos INTEGER NOT NULL CHECK(valor_centavos >= 0),
  forma_pagamento TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_efetiva TEXT,
  recorrencia TEXT,
  parcela_atual INTEGER,
  total_parcelas INTEGER,
  origem_tipo TEXT,
  origem_id INTEGER,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS pagamentos_conta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  valor_centavos INTEGER NOT NULL CHECK(valor_centavos > 0),
  data TEXT NOT NULL,
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cargos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  cbo TEXT,
  salario_base_centavos INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS funcionarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  obra_atual_id INTEGER REFERENCES obras(id),
  cargo_id INTEGER REFERENCES cargos(id),
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  rg TEXT,
  rg_emissao TEXT,
  rg_orgao TEXT,
  data_nascimento TEXT,
  naturalidade TEXT,
  nacionalidade TEXT,
  estado_civil TEXT,
  sexo TEXT,
  escolaridade TEXT,
  pai TEXT,
  mae TEXT,
  ctps TEXT,
  ctps_serie TEXT,
  pis TEXT,
  cnh TEXT,
  titulo_eleitor TEXT,
  certificado_reservista TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  cep TEXT,
  departamento TEXT,
  admissao TEXT,
  salario_centavos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  banco TEXT,
  agencia TEXT,
  conta_bancaria TEXT,
  pix TEXT,
  matricula TEXT,
  jornada_inicio TEXT,
  jornada_fim TEXT,
  intervalo_inicio TEXT,
  intervalo_fim TEXT,
  experiencia_dias INTEGER NOT NULL DEFAULT 45,
  experiencia_fim TEXT,
  vale_transporte_opcao INTEGER,
  vale_transporte_detalhes TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS funcionario_obras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  inicio TEXT NOT NULL,
  fim TEXT,
  observacoes TEXT
);

CREATE TABLE IF NOT EXISTS beneficios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  valor_padrao_centavos INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS funcionario_beneficios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  beneficio_id INTEGER NOT NULL REFERENCES beneficios(id),
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  inicio TEXT,
  fim TEXT,
  UNIQUE(funcionario_id, beneficio_id, inicio)
);

CREATE TABLE IF NOT EXISTS folhas_pagamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  competencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  fechada_em TEXT,
  conta_id INTEGER REFERENCES contas(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, competencia)
);

CREATE TABLE IF NOT EXISTS folha_lancamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folha_id INTEGER NOT NULL REFERENCES folhas_pagamento(id) ON DELETE CASCADE,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  tipo TEXT NOT NULL,
  descricao TEXT,
  natureza TEXT NOT NULL CHECK(natureza IN ('credito','desconto')),
  quinzena INTEGER CHECK(quinzena IN (1,2)),
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  quantidade REAL,
  data TEXT,
  importacao_linha_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagamentos_funcionario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  folha_id INTEGER REFERENCES folhas_pagamento(id),
  competencia TEXT NOT NULL,
  quinzena INTEGER,
  valor_centavos INTEGER NOT NULL,
  data TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS epis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ca TEXT,
  unidade TEXT NOT NULL DEFAULT 'un',
  ativo INTEGER NOT NULL DEFAULT 1,
  UNIQUE(nome, ca)
);

CREATE TABLE IF NOT EXISTS funcionario_epis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  epi_id INTEGER NOT NULL REFERENCES epis(id),
  data_entrega TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 1,
  data_devolucao TEXT,
  quantidade_devolvida REAL,
  observacoes TEXT
);

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
  funcionario_id INTEGER REFERENCES funcionarios(id),
  conta_id INTEGER REFERENCES contas(id),
  medicao_id INTEGER REFERENCES medicoes(id),
  item_orcamentario_id INTEGER REFERENCES itens_orcamentarios(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status_assinatura TEXT NOT NULL DEFAULT 'geral',
  documento_origem_id INTEGER REFERENCES documentos(id),
  versao INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS pastas_vinculadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  obra_id INTEGER REFERENCES obras(id),
  funcionario_id INTEGER REFERENCES funcionarios(id),
  nome TEXT NOT NULL,
  caminho TEXT NOT NULL,
  metadados TEXT,
  disponivel INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arquivo TEXT NOT NULL,
  hash TEXT NOT NULL,
  aba TEXT NOT NULL DEFAULT '2026',
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

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade TEXT NOT NULL,
  entidade_id INTEGER,
  acao TEXT NOT NULL,
  dados TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obras_empresa_status ON obras(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_itens_obra ON itens_orcamentarios(obra_id, etapa_id, local_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_obra_competencia ON medicoes(obra_id, competencia);
CREATE INDEX IF NOT EXISTS idx_contas_competencia ON contas(competencia, tipo, status);
CREATE INDEX IF NOT EXISTS idx_contas_empresa_obra ON contas(empresa_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas(vencimento, status);
CREATE INDEX IF NOT EXISTS idx_funcionarios_empresa_status ON funcionarios(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_folha_competencia ON folhas_pagamento(competencia, status);
CREATE INDEX IF NOT EXISTS idx_documentos_vinculos ON documentos(empresa_id, obra_id, funcionario_id);

INSERT OR IGNORE INTO categorias_financeiras(nome,natureza,grupo_dre) VALUES
 ('Receitas de contratos','receita','receita_operacional'),
 ('Medições','receita','receita_operacional'),
 ('Folha de pagamento','despesa','pessoal'),
 ('Encargos trabalhistas','despesa','pessoal'),
 ('Benefícios','despesa','pessoal'),
 ('Materiais','despesa','custos_obra'),
 ('Ferramentas','despesa','custos_obra'),
 ('Combustível','despesa','custos_obra'),
 ('Serviços terceiros','despesa','operacional'),
 ('Impostos','despesa','tributos'),
 ('Seguros','despesa','operacional'),
 ('Tarifas bancárias','despesa','financeiro'),
 ('Outras despesas','despesa','operacional');

INSERT OR IGNORE INTO cargos(nome,cbo) VALUES ('Encanador','724110'),('Ajudante de Encanador','724110');
INSERT OR IGNORE INTO beneficios(nome,tipo) VALUES ('Vale-transporte','transporte'),('Vale-alimentação','alimentacao'),('Café','alimentacao'),('Prêmio','premio');
INSERT OR IGNORE INTO epis(nome,ca) VALUES
 ('Uniforme','-'),('Botina','12160'),('Capacete com jugular','36099'),('Protetor auditivo','5745'),
 ('Protetor solar','-'),('Touca árabe','-'),('Luva multitato','30916'),('Óculos de proteção','9722'),
 ('Máscara PFF2','10578'),('Cinto de segurança com talabarte e trava-quedas','41046');
