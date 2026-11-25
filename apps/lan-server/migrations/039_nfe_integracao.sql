
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
