-- P2 B5: fechamento auditável do módulo de EXTRATOS E CONCILIAÇÃO bancária.
-- Não altera contas / pagamentos_conta nem representa fechamento contábil de outros módulos.
CREATE TABLE IF NOT EXISTS finance_bank_period_closures (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 period TEXT NOT NULL CHECK(length(period)=7),
 status TEXT NOT NULL CHECK(status IN ('closed','open')),
 audit_snapshot_json TEXT NOT NULL,
 closed_by TEXT NOT NULL,
 closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reopened_by TEXT,
 reopened_at TEXT,
 reopen_reason TEXT,
 UNIQUE(empresa_id,period)
);
CREATE INDEX IF NOT EXISTS idx_bank_closure_company ON finance_bank_period_closures(empresa_id,period,status);
CREATE TABLE IF NOT EXISTS finance_bank_period_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 period TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('closed','reopened')),
 actor TEXT NOT NULL,
 reason TEXT,
 snapshot_json TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bank_period_events ON finance_bank_period_events(empresa_id,period,id);
