CREATE TABLE IF NOT EXISTS cargos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  cbo TEXT,
  salario_base_centavos INTEGER NOT NULL DEFAULT 0 CHECK(salario_base_centavos >= 0),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS beneficios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  valor_padrao_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_padrao_centavos >= 0),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS funcionarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  obra_atual_id INTEGER REFERENCES obras(id),
  cargo_id INTEGER REFERENCES cargos(id),
  nome TEXT NOT NULL,
  cpf TEXT,
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
  salario_centavos INTEGER NOT NULL DEFAULT 0 CHECK(salario_centavos >= 0),
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
  deleted_at TEXT,
  UNIQUE(empresa_id, cpf)
);

CREATE TABLE IF NOT EXISTS funcionario_obras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  obra_id INTEGER NOT NULL REFERENCES obras(id),
  inicio TEXT NOT NULL,
  fim TEXT,
  observacoes TEXT,
  UNIQUE(funcionario_id, obra_id, inicio)
);

CREATE TABLE IF NOT EXISTS cargo_beneficios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  cargo_id INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  beneficio_id INTEGER NOT NULL REFERENCES beneficios(id),
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  quinzena INTEGER NOT NULL DEFAULT 1 CHECK(quinzena IN (1,2)),
  natureza TEXT NOT NULL DEFAULT 'credito' CHECK(natureza IN ('credito','desconto')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),
  UNIQUE(empresa_id, cargo_id, beneficio_id)
);

CREATE TABLE IF NOT EXISTS funcionario_beneficios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  beneficio_id INTEGER NOT NULL REFERENCES beneficios(id),
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  inicio TEXT,
  fim TEXT,
  UNIQUE(funcionario_id, beneficio_id, inicio)
);

CREATE TABLE IF NOT EXISTS folhas_pagamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
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
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  folha_id INTEGER NOT NULL REFERENCES folhas_pagamento(id) ON DELETE CASCADE,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  tipo TEXT NOT NULL,
  descricao TEXT,
  natureza TEXT NOT NULL CHECK(natureza IN ('credito','desconto')),
  quinzena INTEGER CHECK(quinzena IN (1,2)),
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  quantidade REAL,
  data TEXT,
  origem TEXT NOT NULL DEFAULT 'manual',
  editavel INTEGER NOT NULL DEFAULT 1 CHECK(editavel IN (0,1)),
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS pagamentos_funcionario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  folha_id INTEGER REFERENCES folhas_pagamento(id),
  competencia TEXT NOT NULL,
  quinzena INTEGER CHECK(quinzena IN (1,2)),
  valor_centavos INTEGER NOT NULL CHECK(valor_centavos >= 0),
  data TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  forma_pagamento TEXT,
  confirmado_em TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(funcionario_id, competencia, quinzena, status)
);

CREATE TABLE IF NOT EXISTS pontos_mensais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  competencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  preenchimento_automatico INTEGER NOT NULL DEFAULT 0 CHECK(preenchimento_automatico IN (0,1)),
  jornada_inicio TEXT NOT NULL DEFAULT '07:00',
  intervalo_inicio TEXT NOT NULL DEFAULT '11:00',
  intervalo_fim TEXT NOT NULL DEFAULT '12:00',
  jornada_fim TEXT NOT NULL DEFAULT '17:00',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(funcionario_id, competencia)
);

CREATE TABLE IF NOT EXISTS ponto_marcacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  ponto_mensal_id INTEGER NOT NULL REFERENCES pontos_mensais(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'trabalho' CHECK(tipo IN ('trabalho','falta','ferias','feriado','folga','afastado','sabado','domingo')),
  entrada TEXT,
  intervalo_saida TEXT,
  intervalo_entrada TEXT,
  saida TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ponto_mensal_id, data)
);

CREATE TABLE IF NOT EXISTS epis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  ca TEXT,
  unidade TEXT NOT NULL DEFAULT 'un',
  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),
  UNIQUE(empresa_id, nome, ca)
);

CREATE TABLE IF NOT EXISTS funcionario_epis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  epi_id INTEGER NOT NULL REFERENCES epis(id),
  data_entrega TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 1 CHECK(quantidade > 0),
  data_devolucao TEXT,
  quantidade_devolvida REAL,
  observacoes TEXT
);

CREATE INDEX IF NOT EXISTS idx_rh_cargos_empresa ON cargos(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_rh_beneficios_empresa ON beneficios(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_rh_funcionarios_empresa_status ON funcionarios(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_rh_funcionario_obras_empresa ON funcionario_obras(empresa_id, funcionario_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_rh_cargo_beneficios_empresa ON cargo_beneficios(empresa_id, cargo_id, ativo);
CREATE INDEX IF NOT EXISTS idx_rh_func_beneficios_empresa ON funcionario_beneficios(empresa_id, funcionario_id);
CREATE INDEX IF NOT EXISTS idx_rh_folha_empresa_comp ON folhas_pagamento(empresa_id, competencia, status);
CREATE INDEX IF NOT EXISTS idx_rh_lancamentos_empresa_func ON folha_lancamentos(empresa_id, funcionario_id, status);
CREATE INDEX IF NOT EXISTS idx_rh_pagamentos_empresa_func ON pagamentos_funcionario(empresa_id, funcionario_id, competencia, quinzena);
CREATE INDEX IF NOT EXISTS idx_rh_pontos_empresa_func ON pontos_mensais(empresa_id, funcionario_id, competencia);
CREATE INDEX IF NOT EXISTS idx_rh_marcacoes_empresa_ponto ON ponto_marcacoes(empresa_id, ponto_mensal_id, data);
CREATE INDEX IF NOT EXISTS idx_rh_epis_empresa ON epis(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_rh_func_epis_empresa ON funcionario_epis(empresa_id, funcionario_id);
