-- B1/B2: contas bancarias e importacao de extratos. Sem efeito sobre contas/pagamentos_conta.
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL CHECK(length(trim(nome)) BETWEEN 2 AND 120),
  banco_nome TEXT NOT NULL CHECK(length(trim(banco_nome)) BETWEEN 2 AND 120),
  agencia TEXT,
  conta_identificador TEXT,
  tipo_conta TEXT NOT NULL DEFAULT 'corrente' CHECK(tipo_conta IN ('corrente','poupanca','pagamento','outra')),
  saldo_inicial_centavos INTEGER NOT NULL DEFAULT 0,
  saldo_referencia_data TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),
  request_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_empresa ON contas_bancarias(empresa_id,ativo);

CREATE TABLE IF NOT EXISTS extrato_importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  conta_bancaria_id INTEGER NOT NULL REFERENCES contas_bancarias(id),
  nome_arquivo TEXT NOT NULL,
  formato TEXT NOT NULL CHECK(formato IN ('ofx','csv')),
  arquivo_sha256 TEXT NOT NULL,
  mapeamento_json TEXT,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  importadas INTEGER NOT NULL DEFAULT 0,
  duplicadas INTEGER NOT NULL DEFAULT 0,
  rejeitadas INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conta_bancaria_id,arquivo_sha256)
);
CREATE INDEX IF NOT EXISTS idx_extrato_importacoes_empresa ON extrato_importacoes(empresa_id,conta_bancaria_id);

CREATE TABLE IF NOT EXISTS transacoes_bancarias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  conta_bancaria_id INTEGER NOT NULL REFERENCES contas_bancarias(id),
  importacao_id INTEGER NOT NULL REFERENCES extrato_importacoes(id),
  chave_transacao TEXT NOT NULL,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK(valor_centavos != 0),
  origem_identificador TEXT,
  origem_linha INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conta_bancaria_id,chave_transacao)
);
CREATE INDEX IF NOT EXISTS idx_transacoes_bancarias_periodo ON transacoes_bancarias(empresa_id,conta_bancaria_id,data);