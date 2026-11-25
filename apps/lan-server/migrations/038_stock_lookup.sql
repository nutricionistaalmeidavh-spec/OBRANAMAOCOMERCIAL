-- Preserve immutable legacy movements. Indexed lookup matches the stock read and validation model.
CREATE INDEX IF NOT EXISTS idx_stock_identity_normalized ON movimentacoes_estoque(obra_id,COALESCE(frente_id,0),lower(trim(descricao)),lower(trim(unidade)));
CREATE INDEX IF NOT EXISTS idx_stock_history ON movimentacoes_estoque(obra_id,data DESC,id DESC);
