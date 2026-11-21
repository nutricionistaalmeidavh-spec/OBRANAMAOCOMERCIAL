import {it,expect} from 'vitest';
import {assertP0Create} from './web-p0-create';
const c={commandId:'11111111-1111-4111-8111-111111111111',sourceDeviceId:'pc-a'};
it('orçamento e solicitação de compras P1 devem ser idempotentes e usar campos tipados',()=>{
 expect(assertP0Create({...c,entity:'itens_orcamentarios',data:{descricao:'Tubo',unidade:'m',tipo:'material',quantidade:12.5,valor_unitario_centavos:1950}}))
 .toMatchObject({entity:'itens_orcamentarios',data:{quantidade:12.5,valor_unitario_centavos:1950}});
 expect(assertP0Create({...c,entity:'solicitacoes_compra',data:{descricao:'Comprar 12 tubos',solicitante:'João',prazo:'2026-11-25'}}))
 .toMatchObject({entity:'solicitacoes_compra',data:{solicitante:'João'}});
 for(const data of [
  {descricao:'Tubo',unidade:'m',tipo:'material',quantidade:-1,valor_unitario_centavos:1950},
  {descricao:'Tubo',unidade:'m',tipo:'material',quantidade:2,valor_unitario_centavos:1.5},
  {descricao:'Tubo',unidade:'m',tipo:'invalido',quantidade:2,valor_unitario_centavos:1}
 ])expect(()=>assertP0Create({...c,entity:'itens_orcamentarios',data})).toThrow();
 expect(()=>assertP0Create({...c,entity:'solicitacoes_compra',data:{descricao:'Teste'}})).toThrow();
});