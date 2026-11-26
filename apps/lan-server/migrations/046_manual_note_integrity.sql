-- Manual purchases share the canonical fiscal ledgers without inventing XML or fiscal keys.
CREATE TRIGGER IF NOT EXISTS manual_note_update_guard BEFORE UPDATE ON notas_recebidas
 WHEN OLD.chave_acesso IS NULL AND OLD.request_id LIKE 'manual:%' AND OLD.status_integracao IN ('integrada','estornada') AND
 (NEW.request_id IS NOT OLD.request_id OR NEW.chave_acesso IS NOT OLD.chave_acesso OR NEW.empresa_id IS NOT OLD.empresa_id OR NEW.obra_id IS NOT OLD.obra_id OR NEW.fornecedor_id IS NOT OLD.fornecedor_id OR NEW.numero IS NOT OLD.numero OR NEW.serie IS NOT OLD.serie OR NEW.emissao IS NOT OLD.emissao OR NEW.valor_total_centavos IS NOT OLD.valor_total_centavos OR ((NEW.status_integracao IS NOT OLD.status_integracao OR NEW.deleted_at IS NOT OLD.deleted_at) AND NOT (NEW.status_integracao='estornada' AND EXISTS(SELECT 1 FROM nota_recebida_estornos e WHERE e.nota_id=OLD.id))))
 BEGIN SELECT RAISE(ABORT,'Nota fiscal integrada: use a operação canônica.'); END;
CREATE TRIGGER IF NOT EXISTS manual_note_item_update_guard BEFORE UPDATE ON nota_recebida_itens
 WHEN EXISTS(SELECT 1 FROM notas_recebidas n WHERE n.id=OLD.nota_id AND n.chave_acesso IS NULL AND n.request_id LIKE 'manual:%' AND n.status_integracao IN ('integrada','estornada'))
 BEGIN SELECT RAISE(ABORT,'Item fiscal integrado é histórico imutável.'); END;

CREATE TRIGGER IF NOT EXISTS manual_note_delete_guard BEFORE DELETE ON notas_recebidas
 WHEN OLD.chave_acesso IS NULL AND OLD.request_id LIKE 'manual:%' AND OLD.status_integracao IN ('integrada','estornada')
 BEGIN SELECT RAISE(ABORT,'Nota manual integrada: use o estorno canônico.'); END;
CREATE TRIGGER IF NOT EXISTS manual_note_item_delete_guard BEFORE DELETE ON nota_recebida_itens
 WHEN EXISTS(SELECT 1 FROM notas_recebidas n WHERE n.id=OLD.nota_id AND n.chave_acesso IS NULL AND n.request_id LIKE 'manual:%' AND n.status_integracao IN ('integrada','estornada'))
 BEGIN SELECT RAISE(ABORT,'Item integrado é histórico imutável.'); END;
