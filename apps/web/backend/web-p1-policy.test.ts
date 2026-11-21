import { describe,expect,it } from 'vitest';
import { p1Rows,assertP1Edit } from './web-p1-policy';

const row=(entity:string,payload:Record<string,unknown>,localId=1)=>({entity,localId,sourceDeviceId:'desktop-a',mobileEditedRevision:3,desktopRevision:7,payload});

describe('P1: projeções do Desktop sem tabelas sombras',()=>{
  it('lista módulos P1 filtrando excluídos, fonte e colunas privadas',()=>{
    const snapshot={
      rdos:[row('rdos',{data:'2026-11-20',status:'rascunho',clima:'Sol',segredo:'não compartilhar'})],
      checklists:[row('checklist_frente_itens',{descricao:'Instalar tubos',status:'pendente',deleted:true})],
      budgets:[row('itens_orcamentarios',{descricao:'Tubo PVC',valor_unitario_centavos:3500,quantidade:5})],
      measurements:[row('medicoes',{numero:'M-01',valor_liquido_centavos:100000})],
      purchases:[row('pedidos_compra',{descricao:'Tubos',valor_centavos:15000})],
      stock:[row('movimentacoes_estoque',{descricao:'Tubo',quantidade:12,tipo:'entrada'})],
      contracts:[row('contratos_obra',{descricao:'Hidráulica',valor_centavos:80000})],
      documents:[row('documentos',{titulo:'Contrato',categoria:'contrato',arquivo_id:1,caminho:'/secreto'})]
    };
    const rows=p1Rows(snapshot);
    expect(rows.map(r=>r.entity)).toEqual(['rdos','itens_orcamentarios','medicoes','pedidos_compra','movimentacoes_estoque','contratos_obra','documentos']);
    expect(rows[0].payload).not.toHaveProperty('segredo');
    expect(rows.at(-1)?.payload).not.toHaveProperty('caminho');
    expect(rows.every(r=>r.sourceDeviceId==='desktop-a')).toBe(true);
  });
  it('não aceita registros com origem ou ID inválidos',()=>{
    expect(p1Rows({rdos:[{localId:0,sourceDeviceId:'desktop-a',payload:{}},{localId:2,sourceDeviceId:'',payload:{}}]})).toEqual([]);
  });
  it('permite apenas edição de RDO e checklist em campos seguros, com duas revisões',()=>{
    const input={entity:'checklist_frente_itens',localId:15,sourceDeviceId:'desktop-a',expectedRevision:3,expectedDesktopRevision:7,patch:{status:'concluido',responsavel:'Maria'}};
    expect(assertP1Edit(input)).toEqual(input);
    expect(assertP1Edit({...input,entity:'rdos',patch:{clima:'Nublado'}}).entity).toBe('rdos');
    expect(()=>assertP1Edit({...input,entity:'medicoes'})).toThrow();
    expect(()=>assertP1Edit({...input,patch:{obra_id:99}})).toThrow();
  });
  it('bloqueia alterações sem CAS, datas inválidas, estados inválidos e payload excessivo',()=>{
    const input={entity:'checklist_frente_itens',localId:15,sourceDeviceId:'desktop-a',expectedRevision:3,expectedDesktopRevision:7,patch:{status:'concluido'}};
    expect(()=>assertP1Edit({...input,expectedRevision:undefined})).toThrow();
    expect(()=>assertP1Edit({...input,patch:{status:'inventado'}})).toThrow();
    expect(()=>assertP1Edit({...input,patch:{prazo:'2026-02-30'}})).toThrow();
    expect(()=>assertP1Edit({...input,patch:{descricao:'x'.repeat(4001)}})).toThrow();
  });
});
