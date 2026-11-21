-- P0 B3: conciliacao auditavel entre movimentos bancarios e pagamentos canonicos.
-- Reversao por estado: nunca apagar pagamentos_conta ou transacoes_bancarias.
CREATE TABLE IF NOT EXISTS reconciliacao_lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  conta_bancaria_id INTEGER NOT NULL REFERENCES contas_bancarias(id),
  transacao_bancaria_id INTEGER NOT NULL REFERENCES transacoes_bancarias(id),
  request_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reversed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_by TEXT,
  reversed_at TEXT,
  reverse_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_reconciliacao_lotes_empresa ON reconciliacao_lotes(empresa_id,conta_bancaria_id,status,transacao_bancaria_id);
CREATE TABLE IF NOT EXISTS reconciliacao_alocacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id INTEGER NOT NULL REFERENCES reconciliacao_lotes(id),
  pagamento_id INTEGER NOT NULL REFERENCES pagamentos_conta(id),
  valor_centavos INTEGER NOT NULL CHECK(valor_centavos > 0),
  UNIQUE(lote_id,pagamento_id)
);
CREATE INDEX IF NOT EXISTS idx_reconciliacao_alocacoes_pagamento ON reconciliacao_alocacoes(pagamento_id,lote_id);