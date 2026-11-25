
-- Identity catalog only: no balances and no rewriting historical descriptions.
CREATE TABLE materiais_estoque (
 id INTEGER PRIMARY KEY,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 uid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(12)))) CHECK(length(uid)=24 AND uid NOT GLOB '*[^0-9a-f]*'),
 descricao TEXT NOT NULL CHECK(length(trim(descricao))>0),
 unidade TEXT NOT NULL CHECK(length(trim(unidade))>0),
 atributos_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(atributos_json) AND json_type(atributos_json)='object'),
 origem TEXT NOT NULL DEFAULT 'legado' CHECK(origem IN ('legado','confirmado')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_material_exact ON materiais_estoque(empresa_id,lower(trim(descricao)),lower(trim(unidade)));
CREATE TABLE material_fornecedor_equivalencias (
 id INTEGER PRIMARY KEY,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
 material_id INTEGER NOT NULL REFERENCES materiais_estoque(id),
 codigo TEXT NOT NULL CHECK(length(trim(codigo))>0),
 unidade_comercial TEXT NOT NULL CHECK(length(trim(unidade_comercial))>0),
 descricao_origem TEXT NOT NULL,
 gtin TEXT,
 fator_num INTEGER NOT NULL CHECK(typeof(fator_num)='integer' AND fator_num BETWEEN 1 AND 1000000000),
 fator_den INTEGER NOT NULL CHECK(typeof(fator_den)='integer' AND fator_den BETWEEN 1 AND 1000000000),
 confirmado_por TEXT NOT NULL CHECK(length(trim(confirmado_por))>0),
 confirmado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_material_fornecedor_codigo ON material_fornecedor_equivalencias(empresa_id,fornecedor_id,trim(codigo),lower(trim(unidade_comercial)));
CREATE INDEX idx_material_fornecedor_material ON material_fornecedor_equivalencias(material_id);
CREATE TRIGGER material_equivalencia_scope_insert BEFORE INSERT ON material_fornecedor_equivalencias BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM materiais_estoque m WHERE m.id=NEW.material_id AND m.empresa_id=NEW.empresa_id)
 OR NOT EXISTS(SELECT 1 FROM fornecedores f WHERE f.id=NEW.fornecedor_id AND (f.empresa_id IS NULL OR f.empresa_id=NEW.empresa_id) AND f.deleted_at IS NULL)
 THEN RAISE(ABORT,'Equivalência fora da empresa') END;
END;
CREATE TRIGGER material_equivalencia_scope_update BEFORE UPDATE ON material_fornecedor_equivalencias BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM materiais_estoque m WHERE m.id=NEW.material_id AND m.empresa_id=NEW.empresa_id)
 OR NOT EXISTS(SELECT 1 FROM fornecedores f WHERE f.id=NEW.fornecedor_id AND (f.empresa_id IS NULL OR f.empresa_id=NEW.empresa_id) AND f.deleted_at IS NULL)
 THEN RAISE(ABORT,'Equivalência fora da empresa') END;
END;
ALTER TABLE movimentacoes_estoque ADD COLUMN material_id INTEGER REFERENCES materiais_estoque(id);
ALTER TABLE pedido_compra_itens ADD COLUMN material_id INTEGER REFERENCES materiais_estoque(id);
-- Import existing exact groups without guessing abbreviations, packaging or dimensions.
INSERT OR IGNORE INTO materiais_estoque(empresa_id,descricao,unidade)
 SELECT o.empresa_id,MIN(trim(m.descricao)),MIN(trim(m.unidade))
 FROM movimentacoes_estoque m JOIN obras o ON o.id=m.obra_id
 WHERE trim(m.descricao)<>'' AND trim(m.unidade)<>''
 GROUP BY o.empresa_id,lower(trim(m.descricao)),lower(trim(m.unidade));
INSERT OR IGNORE INTO materiais_estoque(empresa_id,descricao,unidade)
 SELECT o.empresa_id,MIN(trim(i.descricao)),MIN(trim(i.unidade))
 FROM pedido_compra_itens i JOIN pedidos_compra p ON p.id=i.pedido_compra_id JOIN obras o ON o.id=p.obra_id
 WHERE trim(i.descricao)<>'' AND trim(i.unidade)<>''
 GROUP BY o.empresa_id,lower(trim(i.descricao)),lower(trim(i.unidade));
UPDATE movimentacoes_estoque SET material_id=(SELECT c.id FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id WHERE o.id=movimentacoes_estoque.obra_id AND lower(trim(c.descricao))=lower(trim(movimentacoes_estoque.descricao)) AND lower(trim(c.unidade))=lower(trim(movimentacoes_estoque.unidade)));
UPDATE pedido_compra_itens SET material_id=(SELECT c.id FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id JOIN pedidos_compra p ON p.obra_id=o.id WHERE p.id=pedido_compra_itens.pedido_compra_id AND lower(trim(c.descricao))=lower(trim(pedido_compra_itens.descricao)) AND lower(trim(c.unidade))=lower(trim(pedido_compra_itens.unidade)));
CREATE INDEX idx_mov_material_obra ON movimentacoes_estoque(obra_id,material_id);
CREATE INDEX idx_pedido_material ON pedido_compra_itens(material_id);
-- Existing manual, XLSX, purchase, RDO and migration writers all pass this same DB boundary.
CREATE TRIGGER stock_material_check_insert BEFORE INSERT ON movimentacoes_estoque WHEN NEW.material_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id WHERE o.id=NEW.obra_id AND c.id=NEW.material_id AND lower(trim(c.unidade))=lower(trim(NEW.unidade))) THEN RAISE(ABORT,'Material ou unidade incompatível com a obra') END;
END;
CREATE TRIGGER stock_material_check_update BEFORE UPDATE OF material_id,obra_id,unidade ON movimentacoes_estoque WHEN NEW.material_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id WHERE o.id=NEW.obra_id AND c.id=NEW.material_id AND lower(trim(c.unidade))=lower(trim(NEW.unidade))) THEN RAISE(ABORT,'Material ou unidade incompatível com a obra') END;
END;
CREATE TRIGGER stock_material_resolve AFTER INSERT ON movimentacoes_estoque WHEN NEW.material_id IS NULL AND trim(NEW.descricao)<>'' AND trim(NEW.unidade)<>'' BEGIN
 INSERT OR IGNORE INTO materiais_estoque(empresa_id,descricao,unidade) SELECT empresa_id,trim(NEW.descricao),trim(NEW.unidade) FROM obras WHERE id=NEW.obra_id;
 UPDATE movimentacoes_estoque SET material_id=(SELECT c.id FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id WHERE o.id=NEW.obra_id AND lower(trim(c.descricao))=lower(trim(NEW.descricao)) AND lower(trim(c.unidade))=lower(trim(NEW.unidade))) WHERE id=NEW.id;
END;
CREATE TRIGGER order_material_check_insert BEFORE INSERT ON pedido_compra_itens WHEN NEW.material_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id JOIN pedidos_compra p ON p.obra_id=o.id WHERE p.id=NEW.pedido_compra_id AND c.id=NEW.material_id AND lower(trim(c.unidade))=lower(trim(NEW.unidade))) THEN RAISE(ABORT,'Material ou unidade incompatível com o pedido') END;
END;
CREATE TRIGGER order_material_check_update BEFORE UPDATE OF material_id,pedido_compra_id,unidade ON pedido_compra_itens WHEN NEW.material_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id JOIN pedidos_compra p ON p.obra_id=o.id WHERE p.id=NEW.pedido_compra_id AND c.id=NEW.material_id AND lower(trim(c.unidade))=lower(trim(NEW.unidade))) THEN RAISE(ABORT,'Material ou unidade incompatível com o pedido') END;
END;
CREATE TRIGGER order_material_resolve AFTER INSERT ON pedido_compra_itens WHEN NEW.material_id IS NULL AND trim(NEW.descricao)<>'' AND trim(NEW.unidade)<>'' BEGIN
 INSERT OR IGNORE INTO materiais_estoque(empresa_id,descricao,unidade) SELECT o.empresa_id,trim(NEW.descricao),trim(NEW.unidade) FROM obras o JOIN pedidos_compra p ON p.obra_id=o.id WHERE p.id=NEW.pedido_compra_id;
 UPDATE pedido_compra_itens SET material_id=(SELECT c.id FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id JOIN pedidos_compra p ON p.obra_id=o.id WHERE p.id=NEW.pedido_compra_id AND lower(trim(c.descricao))=lower(trim(NEW.descricao)) AND lower(trim(c.unidade))=lower(trim(NEW.unidade))) WHERE id=NEW.id;
END;
-- An existing item cannot silently change company, canonical unit or historical identity.
CREATE TRIGGER material_identity_immutable BEFORE UPDATE OF empresa_id,uid,unidade ON materiais_estoque
 WHEN NEW.empresa_id<>OLD.empresa_id OR NEW.uid<>OLD.uid OR lower(trim(NEW.unidade))<>lower(trim(OLD.unidade))
 BEGIN SELECT RAISE(ABORT,'Identidade ou unidade canônica não pode ser alterada'); END;
