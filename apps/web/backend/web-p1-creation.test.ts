import {describe,it,expect} from 'vitest';
import {assertP0Create} from './web-p0-create';
const context={commandId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',sourceDeviceId:'desktop-a'};
describe('P1 criação canônica de checklist e RDO',()=>{
  it('permite checklist com etapa e RDO com data sem criar tabela Web',()=>{
    expect(assertP0Create({...context,entity:'checklist_frente_itens',data:{descricao:'Conferir shafts',frente_id:9,status:'pendente'}}))
      .toMatchObject({entity:'checklist_frente_itens',data:{descricao:'Conferir shafts',frente_id:9}});
    expect(assertP0Create({...context,entity:'rdos',data:{data:'2026-11-21',clima:'Sol'}}))
      .toMatchObject({entity:'rdos',data:{data:'2026-11-21',clima:'Sol'}});
  });
  it('rejeita referências a etapas ausentes, exclusão insegura, campos financeiros e datas inválidas',()=>{
    expect(()=>assertP0Create({...context,entity:'checklist_frente_itens',data:{descricao:'Sem frente'}})).toThrow();
    expect(()=>assertP0Create({...context,entity:'checklist_frente_itens',data:{descricao:'X',frente_id:0}})).toThrow();
    expect(()=>assertP0Create({...context,entity:'checklist_frente_itens',data:{descricao:'X',frente_id:9,valor_centavos:900}})).toThrow();
    expect(()=>assertP0Create({...context,entity:'rdos',data:{data:'2026-02-30'}})).toThrow();
    expect(()=>assertP0Create({...context,entity:'rdos',action:'delete',localId:1,expectedFingerprint:'a'.repeat(64)})).toThrow();
  });
});