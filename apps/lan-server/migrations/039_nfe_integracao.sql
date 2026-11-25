
-- Additive, legacy notes remain documentary records.
ALTER TABLE notas_recebidas ADD COLUMN chave_acesso TEXT;
ALTER TABLE notas_recebidas ADD COLUMN status_integracao TEXT NOT NULL DEFAULT 'documental';
ALTER TABLE notas_recebidas ADD COLUMN total_produtos_centavos INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nota_nfe_chave ON notas_recebidas(empresa_id,chave_acesso) WHERE chave_acesso IS NOT NULL;
ALTER TABLE nota_recebida_itens ADD COLUMN obra_id INTEGER REFERENCES obras(id);
ALTER TABLE nota_recebida_itens ADD COLUMN nfe_item_numero TEXT;
ALTER TABLE nota_recebida_itens ADD COLUMN quantidade_decimal TEXT;
ALTER TABLE nota_recebida_itens ADD COLUMN valor_unitario_decimal TEXT;
CREATE INDEX IF NOT EXISTS idx_nota_itens_obra ON nota_recebida_itens(obra_id,nota_id);
CREATE TABLE IF NOT EXISTS nota_recebida_xml (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nota_id INTEGER NOT NULL UNIQUE REFERENCES notas_recebidas(id),
  sha256 TEXT NOT NULL,
  operacao_sha256 TEXT NOT NULL,
  xml_original BLOB NOT NULL,
  ambiente TEXT NOT NULL,
  protocolo TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS nota_recebida_contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nota_id INTEGER NOT NULL REFERENCES notas_recebidas(id),
  conta_id INTEGER NOT NULL UNIQUE REFERENCES contas(id),
  parcela INTEGER NOT NULL,
  criada_na_importacao INTEGER NOT NULL CHECK(criada_na_importacao IN(0,1)),
  UNIQUE(nota_id,parcela)
);
CREATE TABLE IF NOT EXISTS nota_recebida_recebimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nota_id INTEGER NOT NULL REFERENCES notas_recebidas(id),
  nota_item_id INTEGER NOT NULL REFERENCES nota_recebida_itens(id),
  movimento_id INTEGER UNIQUE REFERENCES movimentacoes_estoque(id),
  recebimento_id INTEGER UNIQUE REFERENCES recebimentos_materiais(id),
  quantidade_decimal TEXT NOT NULL,
  origem TEXT NOT NULL CHECK(origem IN('novo','existente')),
  request_id TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nota_recebimentos_item ON nota_recebida_recebimentos(nota_item_id,id);

CREATE TABLE IF NOT EXISTS nota_recebida_estornos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nota_id INTEGER NOT NULL UNIQUE REFERENCES notas_recebidas(id),
  request_id TEXT NOT NULL UNIQUE,
  motivo TEXT NOT NULL,
  operador TEXT NOT NULL,
  data TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS nota_recebida_estorno_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estorno_id INTEGER NOT NULL REFERENCES nota_recebida_estornos(id),
  recebimento_fiscal_id INTEGER NOT NULL UNIQUE REFERENCES nota_recebida_recebimentos(id),
  movimento_id INTEGER NOT NULL UNIQUE REFERENCES movimentacoes_estoque(id),
  UNIQUE(estorno_id,recebimento_fiscal_id)
);

-- Fiscal quantities stay original; these columns snapshot the approved canonical conversion.
-- The material catalog is introduced by the subsequent migration in this unreleased branch.
ALTER TABLE nota_recebida_itens ADD COLUMN material_id INTEGER REFERENCES materiais_estoque(id);
ALTER TABLE nota_recebida_itens ADD COLUMN unidade_canonica TEXT;
ALTER TABLE nota_recebida_itens ADD COLUMN fator_num INTEGER CHECK(fator_num IS NULL OR fator_num BETWEEN 1 AND 1000000000);
ALTER TABLE nota_recebida_itens ADD COLUMN fator_den INTEGER CHECK(fator_den IS NULL OR fator_den BETWEEN 1 AND 1000000000);
ALTER TABLE nota_recebida_itens ADD COLUMN quantidade_canonica_decimal TEXT;

-- Appropriation is a projection, never another payable. One row per account and cost centre.
CREATE TABLE IF NOT EXISTS nota_recebida_rateios (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 nota_id INTEGER NOT NULL REFERENCES notas_recebidas(id),
 conta_id INTEGER NOT NULL REFERENCES contas(id),
 obra_id INTEGER NOT NULL REFERENCES obras(id),
 frente_id INTEGER REFERENCES frentes_obra(id),
 subfrente_id INTEGER REFERENCES subfrentes_obra(id),
 valor_centavos INTEGER NOT NULL CHECK(valor_centavos>0)
);
CREATE INDEX IF NOT EXISTS idx_nfe_rateio_conta ON nota_recebida_rateios(conta_id,id);
CREATE INDEX IF NOT EXISTS idx_nfe_rateio_obra ON nota_recebida_rateios(obra_id,conta_id);
CREATE VIEW IF NOT EXISTS v_financeiro_apropriacoes AS
 WITH payments AS (SELECT conta_id,SUM(valor_centavos) paid FROM pagamentos_conta GROUP BY conta_id),
 allocated AS (
 SELECT r.*,COALESCE(SUM(r.valor_centavos) OVER(PARTITION BY r.conta_id ORDER BY r.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior
 FROM nota_recebida_rateios r
 )
 SELECT c.id,c.empresa_id,c.obra_id,c.frente_id,NULL subfrente_id,c.tipo,c.categoria_id,c.competencia,c.vencimento,c.status,c.deleted_at,c.valor_centavos,COALESCE(p.paid,0) paid_cents
 FROM contas c LEFT JOIN payments p ON p.conta_id=c.id WHERE NOT EXISTS(SELECT 1 FROM nota_recebida_rateios r WHERE r.conta_id=c.id)
 UNION ALL
 SELECT c.id,c.empresa_id,r.obra_id,r.frente_id,r.subfrente_id,c.tipo,c.categoria_id,c.competencia,c.vencimento,c.status,c.deleted_at,r.valor_centavos,
 MAX(0,MIN(r.valor_centavos,COALESCE(p.paid,0)-r.prior)) paid_cents
 FROM allocated r JOIN contas c ON c.id=r.conta_id LEFT JOIN payments p ON p.conta_id=c.id;

-- Protect the integrated note's financial and physical facts from generic editing.
CREATE TRIGGER IF NOT EXISTS nfe_conta_update_guard BEFORE UPDATE ON contas
 WHEN EXISTS(SELECT 1 FROM nota_recebida_contas l JOIN notas_recebidas n ON n.id=l.nota_id WHERE l.conta_id=OLD.id AND n.status_integracao='integrada')
 AND (NEW.valor_centavos IS NOT OLD.valor_centavos OR NEW.valor_bruto_centavos IS NOT OLD.valor_bruto_centavos OR NEW.empresa_id IS NOT OLD.empresa_id OR NEW.obra_id IS NOT OLD.obra_id OR NEW.frente_id IS NOT OLD.frente_id OR NEW.categoria_id IS NOT OLD.categoria_id OR NEW.tipo IS NOT OLD.tipo OR NEW.competencia IS NOT OLD.competencia OR NEW.fornecedor_id IS NOT OLD.fornecedor_id OR NEW.origem_id IS NOT OLD.origem_id OR NEW.origem_tipo IS NOT OLD.origem_tipo OR NEW.deleted_at IS NOT OLD.deleted_at OR NEW.status='cancelado')
 BEGIN SELECT RAISE(ABORT,'Conta vinculada à NF-e: use conciliação ou estorno integrado.'); END;
CREATE TRIGGER IF NOT EXISTS nfe_payment_amount_guard BEFORE INSERT ON pagamentos_conta
 WHEN EXISTS(SELECT 1 FROM nota_recebida_contas l WHERE l.conta_id=NEW.conta_id)
 AND (NEW.valor_centavos<=0 OR NEW.valor_centavos+COALESCE((SELECT SUM(valor_centavos) FROM pagamentos_conta WHERE conta_id=NEW.conta_id),0)>(SELECT valor_centavos FROM contas WHERE id=NEW.conta_id))
 BEGIN SELECT RAISE(ABORT,'Pagamento excede a parcela fiscal.'); END;
CREATE TRIGGER IF NOT EXISTS nfe_payment_update_guard BEFORE UPDATE ON pagamentos_conta
 WHEN EXISTS(SELECT 1 FROM nota_recebida_contas l WHERE l.conta_id IN (OLD.conta_id,NEW.conta_id))
 AND (NEW.conta_id IS NOT OLD.conta_id OR NEW.valor_centavos IS NOT OLD.valor_centavos)
 BEGIN SELECT RAISE(ABORT,'Baixa de parcela fiscal: revise pelo fluxo financeiro.'); END;
CREATE TRIGGER IF NOT EXISTS nfe_note_update_guard BEFORE UPDATE ON notas_recebidas
 WHEN OLD.chave_acesso IS NOT NULL AND
 (NEW.chave_acesso IS NOT OLD.chave_acesso OR NEW.empresa_id IS NOT OLD.empresa_id OR NEW.obra_id IS NOT OLD.obra_id OR NEW.fornecedor_id IS NOT OLD.fornecedor_id OR NEW.numero IS NOT OLD.numero OR NEW.serie IS NOT OLD.serie OR NEW.emissao IS NOT OLD.emissao OR NEW.valor_total_centavos IS NOT OLD.valor_total_centavos OR ((NEW.status_integracao IS NOT OLD.status_integracao OR NEW.deleted_at IS NOT OLD.deleted_at) AND NOT (NEW.status_integracao='estornada' AND EXISTS(SELECT 1 FROM nota_recebida_estornos e WHERE e.nota_id=OLD.id))))
 BEGIN SELECT RAISE(ABORT,'Nota fiscal integrada: use a operação canônica.'); END;
CREATE TRIGGER IF NOT EXISTS nfe_item_update_guard BEFORE UPDATE ON nota_recebida_itens
 WHEN EXISTS(SELECT 1 FROM notas_recebidas n WHERE n.id=OLD.nota_id AND n.chave_acesso IS NOT NULL)
 BEGIN SELECT RAISE(ABORT,'Item fiscal integrado é histórico imutável.'); END;
CREATE TRIGGER IF NOT EXISTS nfe_movement_update_guard BEFORE UPDATE ON movimentacoes_estoque
 WHEN (EXISTS(SELECT 1 FROM nota_recebida_recebimentos r WHERE r.movimento_id=OLD.id) OR EXISTS(SELECT 1 FROM nota_recebida_estorno_movimentos e WHERE e.movimento_id=OLD.id))
 AND (NEW.tipo IS NOT OLD.tipo OR NEW.quantidade IS NOT OLD.quantidade OR NEW.obra_id IS NOT OLD.obra_id OR NEW.frente_id IS NOT OLD.frente_id OR NEW.unidade IS NOT OLD.unidade OR NEW.descricao IS NOT OLD.descricao OR NEW.pedido_item_id IS NOT OLD.pedido_item_id OR NEW.data IS NOT OLD.data)
 BEGIN SELECT RAISE(ABORT,'Movimentação fiscal histórica: use estorno integrado.'); END;
CREATE TRIGGER IF NOT EXISTS nfe_receipt_update_guard BEFORE UPDATE ON recebimentos_materiais
 WHEN EXISTS(SELECT 1 FROM nota_recebida_recebimentos r WHERE r.recebimento_id=OLD.id)
 AND (NEW.quantidade_recebida IS NOT OLD.quantidade_recebida OR NEW.pedido_item_id IS NOT OLD.pedido_item_id OR NEW.pedido_compra_id IS NOT OLD.pedido_compra_id OR NEW.data IS NOT OLD.data OR NEW.obra_id IS NOT OLD.obra_id OR NEW.frente_id IS NOT OLD.frente_id)
 BEGIN SELECT RAISE(ABORT,'Recebimento fiscal histórico: use estorno integrado.'); END;

-- Read-only projection of each payment onto the fiscal cost allocation.
-- FIFO by allocation id is deterministic and exact at centavo precision;
-- original payments and bank reconciliations remain single canonical records.
CREATE VIEW IF NOT EXISTS v_financeiro_pagamentos_apropriados AS
 WITH pay AS (
 SELECT p.*,COALESCE(SUM(p.valor_centavos) OVER(PARTITION BY p.conta_id ORDER BY p.data,p.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior
 FROM pagamentos_conta p
 ), allocation AS (
 SELECT r.*,COALESCE(SUM(r.valor_centavos) OVER(PARTITION BY r.conta_id ORDER BY r.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior
 FROM nota_recebida_rateios r
 )
 SELECT p.id pagamento_id,p.conta_id,p.data,c.empresa_id,c.obra_id,c.frente_id,NULL subfrente_id,0 rateio_id,p.valor_centavos
 FROM pagamentos_conta p JOIN contas c ON c.id=p.conta_id WHERE NOT EXISTS(SELECT 1 FROM nota_recebida_rateios r WHERE r.conta_id=c.id)
 UNION ALL
 SELECT p.id,p.conta_id,p.data,c.empresa_id,r.obra_id,r.frente_id,r.subfrente_id,r.id,
 MIN(p.prior+p.valor_centavos,r.prior+r.valor_centavos)-MAX(p.prior,r.prior)
 FROM pay p JOIN allocation r ON r.conta_id=p.conta_id JOIN contas c ON c.id=p.conta_id
 WHERE MIN(p.prior+p.valor_centavos,r.prior+r.valor_centavos)>MAX(p.prior,r.prior);
CREATE VIEW IF NOT EXISTS v_financeiro_banco_apropriado AS
 WITH bank AS (
 SELECT a.id,a.pagamento_id,a.valor_centavos,t.id transacao_id,t.data,t.empresa_id,t.conta_bancaria_id,t.valor_centavos sinal,
 COALESCE(SUM(a.valor_centavos) OVER(PARTITION BY a.pagamento_id ORDER BY t.data,t.id,a.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior
 FROM reconciliacao_alocacoes a JOIN reconciliacao_lotes l ON l.id=a.lote_id AND l.status='active' JOIN transacoes_bancarias t ON t.id=l.transacao_bancaria_id
 ), portions AS (
 SELECT p.*,COALESCE(SUM(p.valor_centavos) OVER(PARTITION BY p.pagamento_id ORDER BY p.rateio_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior
 FROM v_financeiro_pagamentos_apropriados p
 )
 SELECT b.transacao_id,b.data,b.empresa_id,b.conta_bancaria_id,p.obra_id,p.frente_id,p.subfrente_id,
 CASE WHEN b.sinal<0 THEN -1 ELSE 1 END*(MIN(b.prior+b.valor_centavos,p.prior+p.valor_centavos)-MAX(b.prior,p.prior)) valor_centavos
 FROM bank b JOIN portions p ON p.pagamento_id=b.pagamento_id AND p.empresa_id=b.empresa_id
 JOIN contas c ON c.id=p.conta_id
 WHERE c.deleted_at IS NULL AND c.status!='cancelado' AND MIN(b.prior+b.valor_centavos,p.prior+p.valor_centavos)>MAX(b.prior,p.prior);
