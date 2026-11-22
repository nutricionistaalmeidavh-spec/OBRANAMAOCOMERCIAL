/** P1: leitura das projeções sincronizadas; fonte operacional continua no Desktop/Server. */
export const P1_SECTIONS = Object.freeze({
  rdos:{ bucket:'rdos', fields:['data','frente_id','clima','status','atividades','observacoes'], editable:['clima','atividades','observacoes'] },
  checklist_frente_itens:{ bucket:'checklists', fields:['descricao','tipo','status','responsavel','prazo','concluido_em','observacoes','frente_id','subfrente_id','pavimento'], editable:['descricao','status','responsavel','prazo','observacoes'] },
  itens_orcamentarios:{ bucket:'budgets', fields:['codigo','descricao','unidade','quantidade','valor_unitario_centavos','tipo','frente_id','etapa_id','subfrente_id','observacoes'], editable:[] },
  medicoes:{ bucket:'measurements', fields:['numero','competencia','data','status','descricao','valor_bruto_centavos','valor_liquido_centavos','observacoes','frente_id'], editable:[] },
  solicitacoes_compra:{ bucket:'purchaseRequests', fields:['descricao','solicitante','status','prioridade','prazo','observacoes','frente_id'], editable:[] },
  pedidos_compra:{ bucket:'purchases', fields:['numero','descricao','status','valor_centavos','entrega_prevista','observacoes','frente_id'], editable:[] },
  movimentacoes_estoque:{ bucket:'stock', fields:['tipo','descricao','unidade','quantidade','data','observacoes','frente_id'], editable:[] },
  contratos_obra:{ bucket:'contracts', fields:['numero','tipo','descricao','valor_centavos','retencao_centavos','status','data_inicio','data_fim','observacoes','frente_id'], editable:[] },
  documentos:{ bucket:'documents', fields:['titulo','categoria','status_assinatura','versao','vencimento','observacoes','rdo_id','medicao_id','contrato_id','pedido_compra_id'], editable:[] },
  pedido_compra_itens:{bucket:'purchaseItems',fields:['pedido_compra_id','descricao','unidade','quantidade_pedida','quantidade_recebida','valor_centavos'],editable:[]},
  medicao_itens:{bucket:'measurementItems',fields:['medicao_id','item_orcamentario_id','descricao','unidade','quantidade_periodo','quantidade_acumulada','valor_periodo_centavos'],editable:[]},
  contrato_aditivos:{bucket:'addenda',fields:['contrato_id','numero','descricao','status','valor_centavos','data','impacto_prazo_dias'],editable:[]},
  recebimentos_materiais:{bucket:'receipts',fields:['pedido_compra_id','pedido_item_id','data','quantidade_recebida','nota_fiscal'],editable:[]}
} as const);
export type P1Entity=keyof typeof P1_SECTIONS;
export type P1Row={entity:P1Entity;localId:number;sourceDeviceId:string;revision:number;desktopRevision:number;payload:Record<string,unknown>};
const record=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const validId=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(new Date(v+'T00:00:00Z').getTime())&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const primitive=(v:unknown):v is string|number|boolean|null=>v===null||['string','number','boolean'].includes(typeof v);

export function p1Rows(bridge:unknown):P1Row[]{
  const all=record(bridge);
  return (Object.entries(P1_SECTIONS) as Array<[P1Entity,(typeof P1_SECTIONS)[P1Entity]]>)
    .flatMap(([entity,section])=>{
      const rows=Array.isArray(all[section.bucket])?all[section.bucket] as unknown[]:[];
      return rows.map(record).filter(row=>{
        const payload=record(row.payload);
        return validId(row.localId)&&typeof row.sourceDeviceId==='string'&&row.sourceDeviceId.length>0&&row.sourceDeviceId.length<=128&&
          row.deleted!==true&&payload.deleted!==true&&(!row.entity||row.entity===entity);
      }).map(row=>{
        const source=record(row.payload),payload:Record<string,unknown>={};
        for(const field of section.fields as readonly string[]){
          if(Object.prototype.hasOwnProperty.call(source,field)&&primitive(source[field])&&String(source[field]??'').length<=4000)payload[field]=source[field];
        }
        return{entity,localId:Number(row.localId),sourceDeviceId:String(row.sourceDeviceId),
          revision:Math.max(0,Number(row.mobileEditedRevision||0)),desktopRevision:Math.max(0,Number(row.desktopRevision||0)),payload};
      });
    });
}

export function assertP1Edit(input:unknown):{
  entity:'rdos'|'checklist_frente_itens';localId:number;sourceDeviceId:string;
  expectedRevision:number;expectedDesktopRevision:number;patch:Record<string,unknown>
}{
  const raw=record(input),entity=String(raw.entity||'');
  if(entity!=='rdos'&&entity!=='checklist_frente_itens')throw new Error('Este módulo é somente leitura na Web; use o fluxo canônico do Desktop.');
  if(!validId(raw.localId)||typeof raw.sourceDeviceId!=='string'||!/^[-\w]{1,128}$/.test(raw.sourceDeviceId))throw new Error('Identidade de origem inválida.');
  if(!Number.isSafeInteger(raw.expectedRevision)||Number(raw.expectedRevision)<0||
     !Number.isSafeInteger(raw.expectedDesktopRevision)||Number(raw.expectedDesktopRevision)<0)throw new Error('Revisões de origem obrigatórias.');
  const patch=record(raw.patch),fields=(P1_SECTIONS[entity].editable as readonly string[]),keys=Object.keys(patch);
  if(!keys.length||keys.length>fields.length)throw new Error('Informe campos editáveis.');
  for(const key of keys){
    if(!fields.includes(key))throw new Error('Campo protegido: '+key);
    const value=patch[key];
    if(!primitive(value)||typeof value==='number'&&!Number.isFinite(value)||typeof value==='boolean')throw new Error('Valor inválido: '+key);
    if(String(value??'').length>(key==='atividades'||key==='observacoes'?4000:250))throw new Error('Campo excede limite: '+key);
    if(key==='descricao'&&!String(value??'').trim())throw new Error('Descrição obrigatória.');
    if(key==='status'&&!['pendente','em_andamento','em_execucao','concluido','bloqueado'].includes(String(value)))throw new Error('Status não permitido.');
    if(key==='prazo'&&value!==''&&value!==null&&!validDate(String(value)))throw new Error('Data de prazo inválida.');
  }
  return{entity,localId:Number(raw.localId),sourceDeviceId:String(raw.sourceDeviceId),expectedRevision:Number(raw.expectedRevision),expectedDesktopRevision:Number(raw.expectedDesktopRevision),patch};
}
