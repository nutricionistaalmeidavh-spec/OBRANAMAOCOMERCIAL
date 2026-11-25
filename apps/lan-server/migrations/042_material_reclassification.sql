
-- Explicit audited reclassification. Original descriptions, quantities, dates and prices remain unchanged.
CREATE TABLE material_reclassificacoes (
 id INTEGER PRIMARY KEY,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 origem_id INTEGER NOT NULL UNIQUE REFERENCES materiais_estoque(id),
 destino_id INTEGER NOT NULL REFERENCES materiais_estoque(id),
 operador TEXT NOT NULL CHECK(length(trim(operador))>0),
 motivo TEXT NOT NULL CHECK(length(trim(motivo))>0),
 movimentacoes INTEGER NOT NULL CHECK(movimentacoes>=0),
 pedidos INTEGER NOT NULL CHECK(pedidos>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(origem_id<>destino_id)
);
CREATE INDEX idx_material_reclass_destino ON material_reclassificacoes(destino_id);
CREATE TRIGGER material_reclass_guard BEFORE INSERT ON material_reclassificacoes BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM materiais_estoque a JOIN materiais_estoque b ON b.id=NEW.destino_id WHERE a.id=NEW.origem_id AND a.empresa_id=NEW.empresa_id AND b.empresa_id=NEW.empresa_id AND lower(trim(a.unidade))=lower(trim(b.unidade)))
 OR EXISTS(SELECT 1 FROM material_reclassificacoes WHERE origem_id=NEW.destino_id OR destino_id=NEW.origem_id)
 OR EXISTS(SELECT 1 FROM material_fornecedor_equivalencias WHERE material_id=NEW.origem_id)
 THEN RAISE(ABORT,'Reclassificação incompatível: empresa, unidade, vínculos ou cadeia') END;
END;
CREATE TRIGGER material_reclass_apply AFTER INSERT ON material_reclassificacoes BEGIN
 UPDATE movimentacoes_estoque SET material_id=NEW.destino_id WHERE material_id=NEW.origem_id;
 UPDATE pedido_compra_itens SET material_id=NEW.destino_id WHERE material_id=NEW.origem_id;
 INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
 INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||NEW.empresa_id,1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER material_reclass_immutable BEFORE UPDATE ON material_reclassificacoes BEGIN SELECT RAISE(ABORT,'Reclassificação auditada é imutável'); END;
CREATE TRIGGER material_alias_retired BEFORE INSERT ON material_fornecedor_equivalencias WHEN EXISTS(SELECT 1 FROM material_reclassificacoes WHERE origem_id=NEW.material_id) BEGIN SELECT RAISE(ABORT,'Material reclassificado: utilize o destino'); END;
CREATE TRIGGER stock_material_redirect AFTER UPDATE OF material_id ON movimentacoes_estoque WHEN EXISTS(SELECT 1 FROM material_reclassificacoes WHERE origem_id=NEW.material_id) BEGIN
 UPDATE movimentacoes_estoque SET material_id=(SELECT destino_id FROM material_reclassificacoes WHERE origem_id=NEW.material_id) WHERE id=NEW.id;
END;
CREATE TRIGGER stock_material_redirect_insert AFTER INSERT ON movimentacoes_estoque WHEN EXISTS(SELECT 1 FROM material_reclassificacoes WHERE origem_id=NEW.material_id) BEGIN
 UPDATE movimentacoes_estoque SET material_id=(SELECT destino_id FROM material_reclassificacoes WHERE origem_id=NEW.material_id) WHERE id=NEW.id;
END;
CREATE TRIGGER order_material_redirect AFTER UPDATE OF material_id ON pedido_compra_itens WHEN EXISTS(SELECT 1 FROM material_reclassificacoes WHERE origem_id=NEW.material_id) BEGIN
 UPDATE pedido_compra_itens SET material_id=(SELECT destino_id FROM material_reclassificacoes WHERE origem_id=NEW.material_id) WHERE id=NEW.id;
END;
CREATE TRIGGER order_material_redirect_insert AFTER INSERT ON pedido_compra_itens WHEN EXISTS(SELECT 1 FROM material_reclassificacoes WHERE origem_id=NEW.material_id) BEGIN
 UPDATE pedido_compra_itens SET material_id=(SELECT destino_id FROM material_reclassificacoes WHERE origem_id=NEW.material_id) WHERE id=NEW.id;
END;
