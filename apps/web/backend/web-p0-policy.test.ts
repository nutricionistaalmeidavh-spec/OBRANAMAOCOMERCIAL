import { describe, expect, it } from 'vitest';
import { assertBridgeEdit, bridgeRows, BridgeConflict } from './web-p0-policy';

describe('P0 gestão web: contratos canônicos', () => {
  it('projeta apenas registros recebidos do Desktop, com identidade e revisão', () => {
    const rows=bridgeRows({
      tasks:[{entity:'tarefas_obra',localId:27,sourceDeviceId:'desktop-a',mobileEditedRevision:8,payload:{titulo:'Revisar rede',status:'aberta'}}],
      fronts:[{entity:'frentes_obra',localId:3,sourceDeviceId:'desktop-a',mobileEditedRevision:0,payload:{nome:'Etapa 1'}}],
      schedule:[{entity:'cronograma_etapas',localId:9,sourceDeviceId:'desktop-a',mobileEditedRevision:2,payload:{status:'atrasada'}}],
      rdos:[{entity:'rdos',localId:5,sourceDeviceId:'desktop-a',mobileEditedRevision:1,payload:{atividades:'Teste'}}]
    });
    expect(rows.map(x=>x.entity)).toEqual(['frentes_obra','tarefas_obra','cronograma_etapas']);
    expect(rows[1]).toMatchObject({localId:27,sourceDeviceId:'desktop-a',revision:8,desktopRevision:0});
  });
  it('recusa alterações fora da lista permitida e rejeita alterações sem revisão', () => {
    expect(()=>assertBridgeEdit({entity:'tarefas_obra',localId:4,sourceDeviceId:'d1',expectedRevision:0,expectedDesktopRevision:0,patch:{obra_id:99}})).toThrow();
    expect(()=>assertBridgeEdit({entity:'tarefas_obra',localId:4,sourceDeviceId:'d1',patch:{titulo:'Outro'}})).toThrow();
    expect(()=>assertBridgeEdit({entity:'tarefas_obra',localId:4,sourceDeviceId:'d1',expectedRevision:0,expectedDesktopRevision:0,patch:{}})).toThrow();
  });
  it('impede substituição silenciosa de edição concorrente', () => {
    const cmd=assertBridgeEdit({entity:'tarefas_obra',localId:3,sourceDeviceId:'pc',expectedRevision:4,expectedDesktopRevision:9,patch:{titulo:'Conferir material'}});
    expect(cmd.patch).toEqual({titulo:'Conferir material'});
    expect(cmd.expectedDesktopRevision).toBe(9);
    expect(()=>{if(cmd.expectedRevision!==5)throw new BridgeConflict();}).toThrow(BridgeConflict);
  });
  it('normaliza avanço percentual e rejeita valores fora do domínio',()=>{
    const command=assertBridgeEdit({entity:'cronograma_etapas',localId:3,sourceDeviceId:'desktop-a',expectedRevision:1,expectedDesktopRevision:6,patch:{percentual_realizado:'45,5'}});
    expect(command.patch.percentual_realizado).toBe(45.5);
    for(const percent of ['101','-1','infinito','NaN']){
      expect(()=>assertBridgeEdit({entity:'cronograma_etapas',localId:3,sourceDeviceId:'desktop-a',expectedRevision:1,expectedDesktopRevision:6,patch:{percentual_realizado:percent}})).toThrow();
    }
  });
  it('não aceita datas inválidas e proíbe alterar vínculos entre etapas ou obras',()=>{
    const input={entity:'cronograma_etapas',localId:3,sourceDeviceId:'pc',expectedRevision:1,expectedDesktopRevision:6};
    expect(()=>assertBridgeEdit({...input,patch:{previsto_fim:'30/11/2026'}})).toThrow();
    expect(()=>assertBridgeEdit({...input,patch:{previsto_fim:'2026-02-30'}})).toThrow();
    expect(()=>assertBridgeEdit({...input,patch:{frente_id:999}})).toThrow();
    expect(assertBridgeEdit({...input,patch:{previsto_fim:'2026-11-30'}}).patch.previsto_fim).toBe('2026-11-30');
  });
  it('não publica registros removidos ou incompletos na visão operacional',()=>{
    const rows=bridgeRows({tasks:[
      {entity:'tarefas_obra',localId:3,sourceDeviceId:'desktop-a',payload:{titulo:'Ativa'}},
      {entity:'tarefas_obra',localId:4,sourceDeviceId:'desktop-a',payload:{titulo:'Excluída',deleted:true}},
      {entity:'tarefas_obra',localId:5,sourceDeviceId:'',payload:{titulo:'Sem autoridade'}}
    ]});
    expect(rows).toHaveLength(1);
  });
});
