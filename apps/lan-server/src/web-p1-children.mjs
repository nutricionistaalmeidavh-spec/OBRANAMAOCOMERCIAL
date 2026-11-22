/**
 * Read-only, bounded child catalogs for P1. Source SQL joins on the parent work,
 * never on user-controlled child IDs alone.
 */
const QUERIES=Object.freeze({
  pedido_compra_itens:`SELECT i.* FROM pedido_compra_itens i
    JOIN pedidos_compra p ON p.id=i.pedido_compra_id
    WHERE p.obra_id=? AND p.deleted_at IS NULL
    ORDER BY i.id DESC LIMIT 250`,
  medicao_itens:`SELECT i.* FROM medicao_itens i
    JOIN medicoes m ON m.id=i.medicao_id
    WHERE m.obra_id=? AND m.deleted_at IS NULL
    ORDER BY i.id DESC LIMIT 250`,
  contrato_aditivos:`SELECT a.* FROM contrato_aditivos a
    JOIN contratos_obra c ON c.id=a.contrato_id
    WHERE c.obra_id=? AND c.deleted_at IS NULL
    ORDER BY a.id DESC LIMIT 250`,
  recebimentos_materiais:`SELECT r.* FROM recebimentos_materiais r
    JOIN pedidos_compra p ON p.id=r.pedido_compra_id
    WHERE p.obra_id=? AND p.deleted_at IS NULL
    ORDER BY r.id DESC LIMIT 250`
});
export const isP1ChildEntity=entity=>Object.hasOwn(QUERIES,String(entity||''));
export function p1ChildRows(repository,entity,workId){
 if(!isP1ChildEntity(entity))throw new Error('Catálogo filho P1 não permitido.');
 const id=Number(workId);
 if(!Number.isSafeInteger(id)||id<1)throw new Error('Obra inválida para consulta P1.');
 const db=repository?.connection?.();
 if(!db?.prepare)throw new Error('Origem operacional indisponível.');
 return db.prepare(QUERIES[entity]).all(id);
}
