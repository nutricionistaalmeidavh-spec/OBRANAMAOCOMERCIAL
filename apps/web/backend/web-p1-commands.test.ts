import {describe,it,expect} from 'vitest';
import {assertP1DomainCommand,isP1DomainEntity} from './web-p1-commands';
const base={commandId:'11111111-1111-4111-8111-111111111111',sourceDeviceId:'pc-a'};
describe('P1 domain commands: schema, idempotency and authorization boundary',()=>{
 it('accepts measurement and calculates totals from validated budget lines',()=>{
  const x=assertP1DomainCommand({...base,entity:'medicoes',data:{numero:'M-1',competencia:'2026-11',data:'2026-11-22',itens:[{item_orcamentario_id:7,quantidade_periodo:2.5,valor_periodo_centavos:8700}]}});
  expect(x).toMatchObject({action:'create',entity:'medicoes',data:{status:'rascunho',valor_bruto_centavos:8700,valor_liquido_centavos:8700,itens:[{item_orcamentario_id:7,quantidade_periodo:2.5}]}});
  expect(()=>assertP1DomainCommand({...base,entity:'medicoes',data:{numero:'M-1',competencia:'2026-11',data:'2026-11-22',itens:[{item_orcamentario_id:0,quantidade_periodo:2,valor_periodo_centavos:1}]}})).toThrow();
 });
 it('validates order items, quantities and derived value',()=>{
  const x=assertP1DomainCommand({...base,entity:'pedidos_compra',data:{descricao:'Comprar tubos',itens:[{descricao:'PVC',unidade:'m',quantidade_pedida:5,valor_centavos:25000}],gerar_conta:true}});
  expect(x.data).toMatchObject({valor_centavos:25000,gerar_conta:true,itens:[{descricao:'PVC',quantidade_pedida:5}]});
  expect(()=>assertP1DomainCommand({...base,entity:'pedidos_compra',data:{descricao:'A',itens:[{descricao:'X',unidade:'m',quantidade_pedida:0,valor_centavos:1}]}})).toThrow();
  expect(()=>assertP1DomainCommand({...base,entity:'pedidos_compra',data:{descricao:'A',itens:[],valor_centavos:999}})).toThrow();
 });
 it('validates receipt, stock movement, contract and addendum without cross-scope IDs',()=>{
  expect(assertP1DomainCommand({...base,entity:'recebimentos_materiais',data:{pedido_item_id:9,quantidade_recebida:2,data:'2026-11-22'}}).entity).toBe('recebimentos_materiais');
  expect(assertP1DomainCommand({...base,entity:'movimentacoes_estoque',data:{tipo:'saida',descricao:'Tubo',unidade:'m',quantidade:3,data:'2026-11-22'}}).entity).toBe('movimentacoes_estoque');
  expect(assertP1DomainCommand({...base,entity:'contratos_obra',data:{descricao:'Execução hidráulica',valor_centavos:350000,gerar_conta:false}}).entity).toBe('contratos_obra');
  expect(assertP1DomainCommand({...base,entity:'contrato_aditivos',data:{contrato_id:7,descricao:'Aditivo',valor_centavos:15000,status:'solicitado'}}).entity).toBe('contrato_aditivos');
  expect(()=>assertP1DomainCommand({...base,entity:'contrato_aditivos',data:{contrato_id:7,descricao:'Aditivo',valor_centavos:15000,status:'contratado'}})).toThrow();
  expect(()=>assertP1DomainCommand({...base,entity:'movimentacoes_estoque',data:{tipo:'saida',descricao:'Tubo',unidade:'m',quantidade:-1,data:'2026-11-22'}})).toThrow();
 });
 it('rejects unknown fields, forged tenant references, bad dates and unsupported actions',()=>{
  expect(isP1DomainEntity('medicoes')).toBe(true);
  expect(isP1DomainEntity('clientes')).toBe(false);
  for(const data of [
   {descricao:'Contrato',valor_centavos:100,empresa_id:999},
   {descricao:'Contrato',valor_centavos:100,obra_id:2},
   {descricao:'Contrato',valor_centavos:-100},
   {descricao:'Contrato',valor_centavos:100,data_inicio:'2026-02-30'}
  ])expect(()=>assertP1DomainCommand({...base,entity:'contratos_obra',data})).toThrow();
  expect(()=>assertP1DomainCommand({...base,action:'delete',entity:'contratos_obra',data:{descricao:'X',valor_centavos:1}})).toThrow();
 });
});