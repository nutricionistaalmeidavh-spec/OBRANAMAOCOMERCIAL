/**
 * P1 domain commands: transport-only envelope, never a Web operational database.
 * All company/work identifiers are injected by the authorized Desktop/LAN source.
 */
export const P1_DOMAIN_ENTITIES=[
  'medicoes','pedidos_compra','recebimentos_materiais',
  'movimentacoes_estoque','contratos_obra','contrato_aditivos'
] as const;
export type P1DomainEntity=typeof P1_DOMAIN_ENTITIES[number];
export const isP1DomainEntity=(v:unknown):v is P1DomainEntity=>
  typeof v==='string'&&(P1_DOMAIN_ENTITIES as readonly string[]).includes(v);
export type P1DomainCommand={
  commandId:string;sourceDeviceId:string;entity:P1DomainEntity;action:'create';data:Record<string,unknown>
};
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const fail=(msg:string):never=>{throw new Error(msg)};
const allowed=(input:Record<string,unknown>,keys:readonly string[])=>{
  for(const k of Object.keys(input))if(!keys.includes(k))fail('Campo não autorizado: '+k);
};
const required=(v:unknown,name:string,max=250)=>{
  if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail('Campo obrigatório/inválido: '+name);
  return(v as string).trim();
};
const optional=(v:unknown,name:string,max=250)=>{
  if(v===undefined||v===null||v==='')return undefined;
  if(typeof v!=='string'||v.length>max)fail('Campo inválido: '+name);
  return v.trim();
};
const positiveId=(v:unknown,name:string)=>{
  if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1||v>100000000)fail('Referência inválida: '+name);
  return v as number;
};
const optId=(v:unknown,name:string)=>v===undefined||v===null||v===''?undefined:positiveId(v,name);
const number=(v:unknown,name:string,{allowZero=false,integer=false,allowNegative=false}={}):number=>{
  if(typeof v!=='number'||!Number.isFinite(v)||(integer&&!Number.isSafeInteger(v))||
     (!allowNegative&&(allowZero?v<0:v<=0))||Math.abs(v)>100000000000)fail('Número inválido: '+name);
  return v as number;
};
const date=(v:unknown,name:string,optionalValue=false)=>{
  if(optionalValue&&(v===null||v===undefined||v===''))return undefined;
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('Data inválida: '+name);
  const parsed=new Date(v+'T00:00:00Z');
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==v)fail('Data inexistente: '+name);
  return v;
};
const money=(v:unknown,name:string,allowNegative=false)=>number(v,name,{allowZero:true,integer:true,allowNegative});
const flag=(v:unknown,name:string)=>{
  if(v===undefined)return false;
  if(typeof v!=='boolean')fail('Opção inválida: '+name);
  return v as boolean;
};
const maxTotal=(values:number[])=>{
  const sum=values.reduce((a,b)=>a+b,0);
  if(!Number.isSafeInteger(sum)||sum>100000000000)fail('Valor total excedeu limite permitido.');
  return sum;
};
export function assertP1DomainCommand(input:unknown):P1DomainCommand{
  const raw=obj(input),entity=raw.entity,action=raw.action||'create';
  if(!isP1DomainEntity(entity)||action!=='create')fail('Operação P1 não autorizada.');
  const commandId=String(raw.commandId||''),sourceDeviceId=String(raw.sourceDeviceId||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))fail('UUID do comando inválido.');
  if(!/^[-\w]{1,128}$/.test(sourceDeviceId))fail('Origem operacional inválida.');
  allowed(raw,['entity','action','commandId','sourceDeviceId','data']);
  const inputData=obj(raw.data),data:Record<string,unknown>={};
  if(!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))fail('Dados do comando inválidos.');
  if(entity==='medicoes'){
    allowed(inputData,['numero','competencia','data','descricao','frente_id','itens']);
    data.numero=required(inputData.numero,'Número da medição');
    if(typeof inputData.competencia!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(inputData.competencia))fail('Competência inválida.');
    data.competencia=inputData.competencia;data.data=date(inputData.data,'Data da medição');
    if(inputData.descricao!==undefined)data.descricao=optional(inputData.descricao,'Descrição',4000);
    if(inputData.frente_id!==undefined)data.frente_id=positiveId(inputData.frente_id,'Etapa');
    const lines=inputData.itens;
    if(!Array.isArray(lines)||!lines.length||lines.length>50)fail('Medição precisa de 1 a 50 itens orçamentários.');
    const seen=new Set<number>();
    const itens=lines.map((line,i)=>{
      const item=obj(line);allowed(item,['item_orcamentario_id','quantidade_periodo','valor_periodo_centavos','justificativa_excesso']);
      const id=positiveId(item.item_orcamentario_id,'Item orçamentário');
      if(seen.has(id))fail('Item repetido na medição.');seen.add(id);
      return{item_orcamentario_id:id,quantidade_periodo:number(item.quantidade_periodo,'Quantidade medida'),
        valor_periodo_centavos:money(item.valor_periodo_centavos,'Valor do item'),
        ...(optional(item.justificativa_excesso,'Justificativa',1000)?{justificativa_excesso:optional(item.justificativa_excesso,'Justificativa',1000)}:{})};
    });
    data.itens=itens;const total=maxTotal(itens.map(item=>item.valor_periodo_centavos));
    Object.assign(data,{status:'rascunho',valor_bruto_centavos:total,valor_liquido_centavos:total,retencoes_centavos:0,descontos_centavos:0});
  }else if(entity==='pedidos_compra'){
    allowed(inputData,['numero','descricao','solicitacao_id','frente_id','entrega_prevista','itens','gerar_conta']);
    data.descricao=required(inputData.descricao,'Descrição');
    if(inputData.numero!==undefined)data.numero=optional(inputData.numero,'Número');
    if(inputData.solicitacao_id!==undefined)data.solicitacao_id=positiveId(inputData.solicitacao_id,'Solicitação');
    if(inputData.frente_id!==undefined)data.frente_id=positiveId(inputData.frente_id,'Etapa');
    if(inputData.entrega_prevista!==undefined)data.entrega_prevista=date(inputData.entrega_prevista,'Entrega',true);
    const lines=inputData.itens;
    if(!Array.isArray(lines)||!lines.length||lines.length>50)fail('Pedido precisa de 1 a 50 itens.');
    const itens=lines.map(line=>{
      const item=obj(line);allowed(item,['descricao','unidade','quantidade_pedida','valor_centavos']);
      return{descricao:required(item.descricao,'Item'),unidade:required(item.unidade,'Unidade',20),
        quantidade_pedida:number(item.quantidade_pedida,'Quantidade pedida'),
        valor_centavos:money(item.valor_centavos,'Valor do item')};
    });
    data.itens=itens;data.valor_centavos=maxTotal(itens.map(item=>item.valor_centavos));
    data.gerar_conta=flag(inputData.gerar_conta,'Gerar conta a pagar');data.status='emitido';
  }else if(entity==='recebimentos_materiais'){
    allowed(inputData,['pedido_item_id','quantidade_recebida','data','nota_fiscal','observacoes']);
    data.pedido_item_id=positiveId(inputData.pedido_item_id,'Item do pedido');
    data.quantidade_recebida=number(inputData.quantidade_recebida,'Quantidade recebida');
    data.data=date(inputData.data,'Data do recebimento');
    for(const key of ['nota_fiscal','observacoes'])if(inputData[key]!==undefined)data[key]=optional(inputData[key],key,key==='observacoes'?4000:250);
  }else if(entity==='movimentacoes_estoque'){
    allowed(inputData,['tipo','descricao','unidade','quantidade','data','frente_id','observacoes']);
    if(!['entrada','saida','ajuste'].includes(String(inputData.tipo)))fail('Tipo de movimentação inválido.');
    data.tipo=inputData.tipo;data.descricao=required(inputData.descricao,'Material');
    data.unidade=required(inputData.unidade,'Unidade',20);
    data.quantidade=number(inputData.quantidade,'Quantidade');data.data=date(inputData.data,'Data');
    if(inputData.frente_id!==undefined)data.frente_id=positiveId(inputData.frente_id,'Etapa');
    if(inputData.observacoes!==undefined)data.observacoes=optional(inputData.observacoes,'Observações',4000);
  }else if(entity==='contratos_obra'){
    allowed(inputData,['numero','descricao','valor_centavos','data_inicio','data_fim','tipo','gerar_conta','frente_id']);
    data.descricao=required(inputData.descricao,'Descrição');data.valor_centavos=money(inputData.valor_centavos,'Valor contratual');
    if(inputData.numero!==undefined)data.numero=optional(inputData.numero,'Número');
    if(inputData.tipo!==undefined)data.tipo=required(inputData.tipo,'Tipo');
    for(const key of ['data_inicio','data_fim'])if(inputData[key]!==undefined)data[key]=date(inputData[key],key,true);
    if(data.data_inicio&&data.data_fim&&String(data.data_fim)<String(data.data_inicio))fail('Término anterior ao início contratual.');
    if(inputData.frente_id!==undefined)data.frente_id=positiveId(inputData.frente_id,'Etapa');
    data.gerar_conta=flag(inputData.gerar_conta,'Gerar conta a receber');data.status='ativo';
  }else if(entity==='contrato_aditivos'){
    allowed(inputData,['contrato_id','descricao','valor_centavos','data','status','impacto_prazo_dias','expectedContractRevision']);
    data.contrato_id=positiveId(inputData.contrato_id,'Contrato');
    data.descricao=required(inputData.descricao,'Descrição');
    data.valor_centavos=money(inputData.valor_centavos,'Valor do aditivo',true);
    data.status=inputData.status||'solicitado';
    if(!['solicitado','contratado'].includes(String(data.status)))fail('Estado do aditivo inválido.');
    if(inputData.data!==undefined)data.data=date(inputData.data,'Data',true);
    if(inputData.impacto_prazo_dias!==undefined)data.impacto_prazo_dias=number(inputData.impacto_prazo_dias,'Impacto do prazo',{allowZero:true,integer:true,allowNegative:true});
    if(data.status==='contratado'){
      data.expectedContractRevision=positiveId(inputData.expectedContractRevision,'Revisão do contrato');
    }else if(inputData.expectedContractRevision!==undefined)fail('Revisão é aceita somente na contratação do aditivo.');
  }
  if(JSON.stringify(data).length>48000)fail('Comando excede o limite seguro.');
  return{entity,action:'create',commandId,sourceDeviceId,data};
}
