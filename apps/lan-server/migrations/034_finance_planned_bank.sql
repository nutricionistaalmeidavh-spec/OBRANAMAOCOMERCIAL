-- P1 C2: explicitar a conta bancária planejada da obrigação, sem alterar o registro canônico.
CREATE TABLE IF NOT EXISTS conta_previsao_bancaria (
  conta_id INTEGER PRIMARY KEY REFERENCES contas(id) ON DELETE CASCADE,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  conta_bancaria_id INTEGER NOT NULL REFERENCES contas_bancarias(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conta_previsao_bancaria_banco ON conta_previsao_bancaria(empresa_id,conta_bancaria_id);
