import {describe,it,expect} from 'vitest';
import {assertP0Create} from './web-p0-create';

const base={commandId:'11111111-1111-4111-8111-111111111111',sourceDeviceId:'desktop-a'};
describe('comandos Web P0 sem tabela operacional paralela',()=>{
  it('valida criação de etapa, subetapa e tarefa com campos permitidos',()=>{
    expect(assertP0Create({...base,entity:'frentes_obra',data:{nome:' Hidráulica ',codigo:'HID'}}).data).toEqual({nome:'Hidráulica',codigo:'HID'});
    expect(assertP0Create({...base,entity:'subfrentes_obra',data:{nome:'Prumadas',frente_id:9}}).data).toEqual({nome:'Prumadas',frente_id:9});
    expect(assertP0Create({...base,entity:'tarefas_obra',data:{titulo:'Comprar tubos',frente_id:9}}).data).toEqual({titulo:'Comprar tubos',frente_id:9});
  });
  it('rejeita referências cruzadas ou controladas pelo cliente',()=>{
    for(const data of [{nome:'Etapa X',obra_id:333},{nome:'Etapa X',id:88},{nome:'Etapa X',revision:8}]){
      expect(()=>assertP0Create({...base,entity:'frentes_obra',data})).toThrow();
    }
    expect(()=>assertP0Create({...base,entity:'subfrentes_obra',data:{nome:'Pavimento 1',frente_id:0}})).toThrow();
    expect(()=>assertP0Create({...base,entity:'tarefas_obra',data:{titulo:''}})).toThrow();
    expect(()=>assertP0Create({...base,entity:'contratos_obra',data:{titulo:'Não permitido'}})).toThrow();
    expect(()=>assertP0Create({...base,entity:'tarefas_obra',data:{titulo:'T',prazo:'30/11/2026'}})).toThrow();
  });
  it('aceita novos clientes e obras mantendo os vínculos controlados pelo executor',()=>{
    expect(assertP0Create({...base,entity:'clientes',data:{nome:'Cliente ABC',email:'contato@cliente.com'}})).toMatchObject({entity:'clientes',action:'create',data:{nome:'Cliente ABC',email:'contato@cliente.com'}});
    expect(assertP0Create({...base,entity:'obras',data:{nome:'Obra Central',cliente_id:25}})).toMatchObject({entity:'obras',data:{nome:'Obra Central',cliente_id:25}});
    expect(()=>assertP0Create({...base,entity:'obras',data:{nome:'Obra',empresa_id:999}})).toThrow();
    expect(()=>assertP0Create({...base,entity:'obras',data:{nome:'Obra',cliente_id:-1}})).toThrow();
  });
  it('exige prova de versão e identidade para exclusão e rejeita exclusão de empresa',()=>{
    const expectedFingerprint='a'.repeat(64);
    expect(assertP0Create({...base,action:'delete',entity:'tarefas_obra',localId:5,expectedFingerprint})).toMatchObject({action:'delete',localId:5,expectedFingerprint});
    expect(()=>assertP0Create({...base,action:'delete',entity:'tarefas_obra',localId:5})).toThrow();
    expect(()=>assertP0Create({...base,action:'delete',entity:'empresas',localId:5,expectedFingerprint})).toThrow();
    expect(()=>assertP0Create({...base,action:'delete',entity:'tarefas_obra',localId:0,expectedFingerprint})).toThrow();
  });
  it('recusa comando sem identificador único, dispositivo ou com campos excessivos',()=>{
    expect(()=>assertP0Create({...base,commandId:'123',entity:'tarefas_obra',data:{titulo:'Teste'}})).toThrow();
    expect(()=>assertP0Create({...base,sourceDeviceId:'',entity:'tarefas_obra',data:{titulo:'Teste'}})).toThrow();
    expect(()=>assertP0Create({...base,entity:'tarefas_obra',data:{titulo:'a'.repeat(300)}})).toThrow();
  });
});
