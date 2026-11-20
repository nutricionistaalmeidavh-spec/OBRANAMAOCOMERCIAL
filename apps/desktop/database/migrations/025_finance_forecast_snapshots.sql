-- C4: previsão histórica imutável capturada por decisão explícita do gestor no Desktop.
-- Não altera obrigações, pagamentos ou extratos; snapshots locais e no servidor seguem a fonte canônica.
CREATE TABLE IF NOT EXISTS finance_bank_forecast_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 as_of TEXT NOT NULL,
 horizon_days INTEGER NOT NULL CHECK(horizon_days IN (30,60,90)),
 conta_bancaria_id INTEGER REFERENCES contas_bancarias(id),
 obra_id INTEGER REFERENCES obras(id),
 request_id TEXT NOT NULL UNIQUE,
 scope_hash TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 snapshot_json TEXT NOT NULL CHECK(length(snapshot_json)>0)
);
CREATE INDEX IF NOT EXISTS idx_bank_forecast_company ON finance_bank_forecast_snapshots(empresa_id,as_of DESC,created_at DESC,id DESC);


-- Imutabilidade aplicada no próprio banco, inclusive contra alterações fora da interface.
CREATE TRIGGER IF NOT EXISTS trg_finance_forecast_immutable_update
BEFORE UPDATE ON finance_bank_forecast_snapshots
BEGIN
 SELECT RAISE(ABORT, 'previsao historica imutavel');
END;
CREATE TRIGGER IF NOT EXISTS trg_finance_forecast_immutable_delete
BEFORE DELETE ON finance_bank_forecast_snapshots
BEGIN
 SELECT RAISE(ABORT, 'previsao historica imutavel');
END;
