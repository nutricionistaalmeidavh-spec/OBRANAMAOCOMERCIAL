
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
  nota_id INTEGER PRIMARY KEY REFERENCES notas_recebidas(id),
  sha256 TEXT NOT NULL,
  operacao_sha256 TEXT NOT NULL,
  xml_original BLOB NOT NULL,
  ambiente TEXT NOT NULL,
  protocolo TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS nota_recebida_contas (
  nota_id INTEGER NOT NULL REFERENCES notas_recebidas(id),
  conta_id INTEGER NOT NULL UNIQUE REFERENCES contas(id),
  parcela INTEGER NOT NULL,
  criada_na_importacao INTEGER NOT NULL CHECK(criada_na_importacao IN(0,1)),
  PRIMARY KEY(nota_id,parcela)
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
