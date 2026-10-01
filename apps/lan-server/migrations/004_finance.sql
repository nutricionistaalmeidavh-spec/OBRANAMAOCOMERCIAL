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

CREATE TABLE IF NOT EXISTS categorias_financeiras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  natureza TEXT NOT NULL CHECK(natureza IN ('receita','despesa')),
  grupo_dre TEXT NOT NULL DEFAULT 'operacional',
  ativa INTEGER NOT NULL DEFAULT 1 CHECK(ativa IN (0,1))
);

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK(tipo IN ('pagar','receber')),
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  obra_id INTEGER REFERENCES obras(id),
  frente_id INTEGER REFERENCES frentes_obra(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  cliente_id INTEGER REFERENCES clientes(id),
  categoria_id INTEGER REFERENCES categorias_financeiras(id),
  medicao_id INTEGER,
  descricao TEXT NOT NULL,
  competencia TEXT NOT NULL,
  emissao TEXT,
  vencimento TEXT NOT NULL,
  valor_bruto_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_bruto_centavos >= 0),
  retencoes_centavos INTEGER NOT NULL DEFAULT 0 CHECK(retencoes_centavos >= 0),
  descontos_centavos INTEGER NOT NULL DEFAULT 0 CHECK(descontos_centavos >= 0),
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
  request_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_nome ON fornecedores(empresa_id, nome);
CREATE INDEX IF NOT EXISTS idx_contas_empresa_obra ON contas(empresa_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_contas_competencia ON contas(competencia, tipo, status);
CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas(vencimento, status);
CREATE INDEX IF NOT EXISTS idx_contas_frente ON contas(obra_id, frente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_conta_conta ON pagamentos_conta(conta_id, data);

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
