CREATE TABLE estoque_revisoes (escopo TEXT PRIMARY KEY, revisao INTEGER NOT NULL DEFAULT 0);
CREATE TRIGGER estoque_rev_movimentacoes_estoque_insert AFTER INSERT ON movimentacoes_estoque BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_movimentacoes_estoque_update AFTER UPDATE ON movimentacoes_estoque BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_movimentacoes_estoque_delete AFTER DELETE ON movimentacoes_estoque BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_pedido_compra_itens_insert AFTER INSERT ON pedido_compra_itens BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=NEW.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=NEW.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_pedido_compra_itens_update AFTER UPDATE ON pedido_compra_itens BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=OLD.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=OLD.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=NEW.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=NEW.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_pedido_compra_itens_delete AFTER DELETE ON pedido_compra_itens BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=OLD.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=(SELECT obra_id FROM pedidos_compra WHERE id=OLD.pedido_compra_id) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_materiais_estoque_insert AFTER INSERT ON materiais_estoque BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(NEW.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_materiais_estoque_update AFTER UPDATE ON materiais_estoque BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(OLD.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(NEW.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_materiais_estoque_delete AFTER DELETE ON materiais_estoque BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(OLD.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_material_fornecedor_equivalencias_insert AFTER INSERT ON material_fornecedor_equivalencias BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(NEW.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_material_fornecedor_equivalencias_update AFTER UPDATE ON material_fornecedor_equivalencias BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(OLD.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(NEW.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_material_fornecedor_equivalencias_delete AFTER DELETE ON material_fornecedor_equivalencias BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(OLD.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_frentes_obra_insert AFTER INSERT ON frentes_obra BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_frentes_obra_update AFTER UPDATE ON frentes_obra BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=NEW.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_frentes_obra_delete AFTER DELETE ON frentes_obra BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=OLD.obra_id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_obras_insert AFTER INSERT ON obras BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=NEW.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=NEW.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_obras_update AFTER UPDATE ON obras BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=OLD.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=OLD.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=NEW.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=NEW.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_obras_delete AFTER DELETE ON obras BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'obra:'||id,1 FROM obras WHERE id=OLD.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) SELECT 'empresa:'||empresa_id,1 FROM obras WHERE id=OLD.id ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_empresas_insert AFTER INSERT ON empresas BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||NEW.id,1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_empresas_update AFTER UPDATE ON empresas BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||OLD.id,1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||NEW.id,1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_empresas_delete AFTER DELETE ON empresas BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||OLD.id,1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_fornecedores_insert AFTER INSERT ON fornecedores BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(NEW.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_fornecedores_update AFTER UPDATE ON fornecedores BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(OLD.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(NEW.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TRIGGER estoque_rev_fornecedores_delete AFTER DELETE ON fornecedores BEGIN
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('all',1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
INSERT INTO estoque_revisoes(escopo,revisao) VALUES('catalogo:'||COALESCE(OLD.empresa_id,0),1) ON CONFLICT(escopo) DO UPDATE SET revisao=revisao+1;
END;
CREATE TABLE estoque_revisao_identidade (id INTEGER PRIMARY KEY CHECK(id=1), uid TEXT NOT NULL DEFAULT (lower(hex(randomblob(12)))));
INSERT INTO estoque_revisao_identidade(id) VALUES(1);
