import { describe, expect, it } from 'vitest';
import { assertBridgeEdit, bridgeRows } from './web-p0-policy';

describe('Web P0 — subetapas e cronograma vinculados',()=>{
  it('mantém subetapa vinculada à etapa real e ao dispositivo de origem',()=>{
    const rows=bridgeRows({
      fronts:[{localId:10,sourceDeviceId:'pc-a',payload:{nome:'Hidráulica'}}],
      subfronts:[{localId:35,sourceDeviceId:'pc-a',payload:{nome:'Prumadas',frente_id:10,obra_id:2,status:'ativa'}}],
      schedule:[{localId:7,sourceDeviceId:'pc-a',payload:{nome:'Cronograma hidráulico',frente_id:10,previsto_fim:'2026-10-01',percentual_realizado:30}}]
    });
    expect(rows.map(r=>r.entity)).toEqual(['frentes_obra','subfrentes_obra','cronograma_etapas']);
    expect(rows[1]).toMatchObject({localId:35,payload:{frente_id:10,obra_id:2}});
  });
  it('permite atualizar nome, escopo e observações da subetapa, mas nunca mudar seu vínculo',()=>{
    expect(assertBridgeEdit({entity:'subfrentes_obra',localId:35,sourceDeviceId:'pc-a',expectedRevision:0,expectedDesktopRevision:1,patch:{nome:'Louças',escopo:'Torre A'}}).patch).toEqual({nome:'Louças',escopo:'Torre A'});
    expect(()=>assertBridgeEdit({entity:'subfrentes_obra',localId:35,sourceDeviceId:'pc-a',expectedRevision:0,expectedDesktopRevision:1,patch:{frente_id:99}})).toThrow(/não autorizado/);
  });
});
