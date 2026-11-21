-- Saldos de conferência são referências absolutas, NÃO movimentações bancárias.
-- Importações anteriores ou na mesma data da referência nunca são somadas ao saldo.
CREATE TABLE IF NOT EXISTS finance_bank_manual_balances (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 conta_bancaria_id INTEGER NOT NULL REFERENCES contas_bancarias(id),
 data TEXT NOT NULL CHECK(length(data)=10),
 saldo_centavos INTEGER NOT NULL,
 justificativa TEXT NOT NULL CHECK(length(trim(justificativa)) BETWEEN 8 AND 500),
 created_by TEXT NOT NULL,
 request_id TEXT NOT NULL UNIQUE,
 request_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_finance_manual_balances_account_date
 ON finance_bank_manual_balances(empresa_id,conta_bancaria_id,data DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS finance_manual_balance_immutable_update
 BEFORE UPDATE ON finance_bank_manual_balances BEGIN SELECT RAISE(ABORT,'Saldo manual imutável. Registre nova referência para corrigir.'); END;
CREATE TRIGGER IF NOT EXISTS finance_manual_balance_immutable_delete
 BEFORE DELETE ON finance_bank_manual_balances BEGIN SELECT RAISE(ABORT,'Saldo manual imutável. Registre nova referência para corrigir.'); END;
