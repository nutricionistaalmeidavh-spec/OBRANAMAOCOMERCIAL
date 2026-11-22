/** P1 operational forms. Pure rendering/validation; all writes go to the canonical source command queue. */
type Row={entity:string;localId:number;sourceDeviceId:string;payload:Record<string,unknown>};
export const P1_DOMAIN_ENTITIES=['medicoes','pedidos_compra','recebimentos_materiais','movimentacoes_estoque','contratos_obra','contrato_aditivos'] as const;
export const isP1Domain=(entity:string)=>P1_DOMAIN_ENTITIES.some(x=>x===entity);
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));
const money=(cents:unknown)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents||0)/100);
const input=(name:string,title:string,{type='text',required=false,value='',step='',min='',max='250'}={})=>
  '<label class="p0-field"><span>'+esc(title)+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'"'+(required?' required':'')+
  (step?' step="'+step+'"':'')+(min?' min="'+min+'"':'')+' maxlength="'+max+'"></label>';
const field=(name:string,title:string,options:string,required=false)=>'<label class="p0-field"><span>'+esc(title)+'</span><select name="'+name+'"'+(required?' required':'')+'>'+options+'</select></label>';
const opts=(items:Row[],title:(item:Row)=>string)=>items.map(item=>'<option value="'+item.localId+'">'+esc(title(item))+'</option>').join('');
const row=(children:string)=>'<div class="p1-form-line" data-p1-line>'+children+'</div>';
const number=(value:string,name:string,{integer=false,positive=false}={})=>{
  const n=Number(value);
  if(!value||!Number.isFinite(n)||(integer&&!Number.isSafeInteger(n))||(positive?n<=0:n<0)||n>100000000000)throw new Error('Valor inválido: '+name);
  return n;
};
const cents=(value:string,name:string,allowNegative=false)=>{
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(value)||(value.startsWith('-')&&!allowNegative))throw new Error('Valor em reais inválido: '+name);
  const parsed=Math.round(Number(value)*100);
  if(!Number.isSafeInteger(parsed)||Math.abs(parsed)>100000000000)throw new Error('Valor acima do limite: '+name);
  return parsed;
};
const requireText=(value:string,name:string)=>{const clean=value.trim();if(!clean)throw new Error('Preencha '+name+'.');return clean};
export function renderP1DomainFields(entity:string,items:Row[],source:string):string{
  const same=items.filter(item=>item.sourceDeviceId===source);
  const stages=same.filter(row=>row.entity==='frentes_obra');
  const budget=same.filter(row=>row.entity==='itens_orcamentarios');
  const orderItems=same.filter(row=>row.entity==='pedido_compra_itens'&&Number(row.payload.quantidade_pedida||0)>Number(row.payload.quantidade_recebida||0));
  const contracts=same.filter(row=>row.entity==='contratos_obra');
  const stage=field('frente_id','Etapa vinculada (opcional)','<option value="">Obra geral</option>'+opts(stages,x=>String(x.payload.nome||x.localId)));
  if(entity==='medicoes'){
    const line=row(field('item_orcamentario_id','Item do orçamento',opts(budget,x=>String(x.payload.descricao||x.localId)+' · '+money(x.payload.valor_unitario_centavos)),true)+
      input('quantidade_periodo','Quantidade medida',{type:'number',step:'0.001',min:'0.001',required:true})+
      input('valor_periodo_reais','Valor do período (R$)',{type:'number',step:'0.01',min:'0',required:true}));
    return input('numero','Número da medição',{required:true})+input('competencia','Competência',{type:'month',required:true})+
      input('data','Data',{type:'date',required:true})+stage+
      (budget.length?'<fieldset class="p1-line-set"><legend>Itens medidos</legend><div id="p1Lines">'+line+'</div>'+
        '<button type="button" class="p0-light" id="p1AddLine">Adicionar item</button></fieldset>':'<p class="p1-readonly">Cadastre itens no orçamento e sincronize antes de medir.</p>');
  }
  if(entity==='pedidos_compra'){
    const line=row(input('descricao_item','Material ou serviço',{required:true})+
      input('unidade','Unidade',{required:true,value:'un'})+
      input('quantidade_pedida','Quantidade',{type:'number',step:'0.001',min:'0.001',required:true})+
      input('valor_item_reais','Valor total do item (R$)',{type:'number',step:'0.01',min:'0',required:true}));
    return input('descricao','Descrição do pedido',{required:true})+input('numero','Número do pedido')+
      input('entrega_prevista','Entrega prevista',{type:'date'})+stage+
      '<fieldset class="p1-line-set"><legend>Itens do pedido</legend><div id="p1Lines">'+line+'</div>'+
      '<button type="button" class="p0-light" id="p1AddLine">Adicionar item</button></fieldset>'+
      '<label class="p1-confirm"><input type="checkbox" name="gerar_conta"> Gerar conta a pagar no Financeiro</label>';
  }
  if(entity==='recebimentos_materiais'){
    return(orderItems.length?field('pedido_item_id','Item pendente do pedido',opts(orderItems,x=>
      String(x.payload.descricao||'Item')+' · Pedido '+x.payload.pedido_compra_id+
      ' · faltam '+(Number(x.payload.quantidade_pedida||0)-Number(x.payload.quantidade_recebida||0))),true):
      '<p class="p1-readonly">Nenhum item de pedido pendente disponível. Sincronize os pedidos antes do recebimento.</p>')+
      input('quantidade_recebida','Quantidade recebida',{type:'number',step:'0.001',min:'0.001',required:true})+
      input('data','Data do recebimento',{type:'date',required:true})+input('nota_fiscal','Número da nota fiscal');
  }
  if(entity==='movimentacoes_estoque'){
    return field('tipo','Movimentação','<option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste positivo</option>',true)+
      input('descricao','Material',{required:true})+input('unidade','Unidade',{required:true,value:'un'})+
      input('quantidade','Quantidade',{type:'number',step:'0.001',min:'0.001',required:true})+
      input('data','Data',{type:'date',required:true})+stage;
  }
  if(entity==='contratos_obra'){
    return input('descricao','Objeto do contrato',{required:true})+input('numero','Número')+
      input('valor_reais','Valor do contrato (R$)',{type:'number',step:'0.01',min:'0',required:true})+
      input('data_inicio','Início',{type:'date'})+input('data_fim','Término',{type:'date'})+stage+
      '<label class="p1-confirm"><input type="checkbox" name="gerar_conta"> Criar conta a receber (somente edição empreiteira)</label>';
  }
  if(entity==='contrato_aditivos'){
    return(contracts.length?field('contrato_id','Contrato',opts(contracts,x=>String(x.payload.descricao||x.localId)),true):
      '<p class="p1-readonly">Não há contratos sincronizados nesta obra.</p>')+
      input('descricao','Descrição do aditivo',{required:true})+
      input('valor_reais','Variação de valor (R$)',{type:'number',step:'0.01',required:true})+
      input('data','Data',{type:'date'})+
      '<p class="p1-readonly">Novo aditivo fica como solicitado. Contratação e efeitos financeiros exigem aprovação no Desktop.</p>';
  }
  return '';
}
export function appendP1DomainLine(form:HTMLFormElement){
  const container=form.querySelector('#p1Lines'),first=container?.querySelector<HTMLElement>('[data-p1-line]');
  if(!container||!first||container.querySelectorAll('[data-p1-line]').length>=50)return false;
  const copy=first.cloneNode(true) as HTMLElement;
  copy.querySelectorAll<HTMLInputElement>('input').forEach(input=>{
    if(input.name==='unidade')input.value='un';else input.value='';
  });
  container.append(copy);
  return true;
}
export function parseP1DomainForm(entity:string,form:HTMLFormElement):Record<string,unknown>{
  const values=new FormData(form),v=(key:string)=>String(values.get(key)||'').trim();
  const data:Record<string,unknown>={};
  const optional=(key:string)=>{if(v(key))data[key]=v(key)};
  const stage=()=>{if(v('frente_id'))data.frente_id=number(v('frente_id'),'Etapa',{integer:true,positive:true})};
  const parseLines=(converter:(row:HTMLElement)=>Record<string,unknown>)=>{
    const lines=[...form.querySelectorAll<HTMLElement>('[data-p1-line]')];
    if(!lines.length||lines.length>50)throw new Error('Preencha de 1 a 50 itens.');
    return lines.map(converter);
  };
  const lineValue=(row:HTMLElement,name:string)=>String(row.querySelector<HTMLInputElement|HTMLSelectElement>('[name="'+name+'"]')?.value||'').trim();
  if(entity==='medicoes'){
    data.numero=requireText(v('numero'),'o número');data.competencia=requireText(v('competencia'),'a competência');
    data.data=requireText(v('data'),'a data');stage();
    data.itens=parseLines(row=>({
      item_orcamentario_id:number(lineValue(row,'item_orcamentario_id'),'Item orçamentário',{integer:true,positive:true}),
      quantidade_periodo:number(lineValue(row,'quantidade_periodo'),'Quantidade medida',{positive:true}),
      valor_periodo_centavos:cents(lineValue(row,'valor_periodo_reais'),'Valor medido')
    }));
  }else if(entity==='pedidos_compra'){
    data.descricao=requireText(v('descricao'),'a descrição');optional('numero');optional('entrega_prevista');stage();
    data.itens=parseLines(row=>({
      descricao:requireText(lineValue(row,'descricao_item'),'o item'),
      unidade:requireText(lineValue(row,'unidade'),'a unidade'),
      quantidade_pedida:number(lineValue(row,'quantidade_pedida'),'Quantidade pedida',{positive:true}),
      valor_centavos:cents(lineValue(row,'valor_item_reais'),'Valor do item')
    }));
    data.gerar_conta=values.get('gerar_conta')==='on';
  }else if(entity==='recebimentos_materiais'){
    data.pedido_item_id=number(v('pedido_item_id'),'Item do pedido',{integer:true,positive:true});
    data.quantidade_recebida=number(v('quantidade_recebida'),'Quantidade recebida',{positive:true});
    data.data=requireText(v('data'),'a data');optional('nota_fiscal');
  }else if(entity==='movimentacoes_estoque'){
    data.tipo=v('tipo');data.descricao=requireText(v('descricao'),'o material');
    data.unidade=requireText(v('unidade'),'a unidade');
    data.quantidade=number(v('quantidade'),'Quantidade',{positive:true});
    data.data=requireText(v('data'),'a data');stage();
  }else if(entity==='contratos_obra'){
    data.descricao=requireText(v('descricao'),'o objeto');optional('numero');
    data.valor_centavos=cents(v('valor_reais'),'Valor contratual');optional('data_inicio');optional('data_fim');stage();
    data.gerar_conta=values.get('gerar_conta')==='on';
  }else if(entity==='contrato_aditivos'){
    data.contrato_id=number(v('contrato_id'),'Contrato',{integer:true,positive:true});
    data.descricao=requireText(v('descricao'),'a descrição');
    data.valor_centavos=cents(v('valor_reais'),'Valor do aditivo',true);
    optional('data');data.status='solicitado';
  }else throw new Error('Operação não disponível.');
  return data;
}
