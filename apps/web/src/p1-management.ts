import { api } from './cloudflare-client';
import {isP1Domain,renderP1DomainFields,appendP1DomainLine,parseP1DomainForm} from './p1-domain-forms';
import './p0-management.css';
import './p1-management.css';

type Entity='rdos'|'checklist_frente_itens'|'itens_orcamentarios'|'medicoes'|'solicitacoes_compra'|'pedidos_compra'|'movimentacoes_estoque'|'contratos_obra'|'documentos'|'pedido_compra_itens'|'medicao_itens'|'recebimentos_materiais'|'contrato_aditivos';
type Row={entity:Entity;localId:number;sourceDeviceId:string;revision:number;desktopRevision:number;payload:Record<string,unknown>};
type Overview={
  company:{id:string;name:string};project:{id:string;name:string};
  topology:{mode:string};items:Row[];limitations:string[];capabilities?:{finance:boolean;documents?:boolean};
  sources?:Array<{deviceId:string;name:string}>;
  stages?:Array<{entity:'frentes_obra'|'subfrentes_obra';localId:number;sourceDeviceId:string;name:string;frenteId?:number}>;
  commands?:Array<{id:string;entity:string;status:string;error?:string;createdAt:string}>;
};
const groups:Record<Entity,{title:string;label:string;fields:string[];editable:string[];display:string[]}>={
  rdos:{title:'Diário de obra',label:'RDO',fields:['data','status','clima','atividades','observacoes'],editable:['clima','atividades','observacoes'],display:['data','status','clima','atividades','observacoes']},
  checklist_frente_itens:{title:'Checklists e vistorias',label:'Checklist',fields:['descricao','tipo','status','responsavel','prazo','observacoes'],editable:['descricao','status','responsavel','prazo','observacoes'],display:['descricao','tipo','status','responsavel','prazo','concluido_em','observacoes']},
  itens_orcamentarios:{title:'Orçamento',label:'Item orçamentário',fields:[],editable:[],display:['codigo','descricao','quantidade','unidade','valor_unitario_centavos','tipo']},
  medicoes:{title:'Medições',label:'Medição',fields:[],editable:[],display:['numero','competencia','data','status','valor_bruto_centavos','valor_liquido_centavos']},
  solicitacoes_compra:{title:'Solicitações de compra',label:'Solicitação',fields:[],editable:[],display:['descricao','solicitante','prazo','prioridade','status']},
  pedidos_compra:{title:'Pedidos de compra',label:'Pedido',fields:[],editable:[],display:['numero','descricao','valor_centavos','entrega_prevista','status']},
  movimentacoes_estoque:{title:'Movimentações de estoque',label:'Movimentação',fields:[],editable:[],display:['descricao','tipo','quantidade','unidade','data']},
  contratos_obra:{title:'Contratos',label:'Contrato',fields:[],editable:[],display:['numero','descricao','valor_centavos','data_inicio','data_fim','status']},
  documentos:{title:'Documentos e anexos',label:'Documento',fields:[],editable:[],display:['titulo','categoria','versao','status_assinatura','vencimento']},
  pedido_compra_itens:{title:'Itens dos pedidos',label:'Item de compra',fields:[],editable:[],display:['pedido_compra_id','descricao','quantidade_pedida','quantidade_recebida','unidade','valor_centavos']},
  medicao_itens:{title:'Itens medidos',label:'Item de medição',fields:[],editable:[],display:['medicao_id','descricao','quantidade_periodo','quantidade_acumulada','unidade','valor_periodo_centavos']},
  recebimentos_materiais:{title:'Recebimentos',label:'Recebimento',fields:[],editable:[],display:['pedido_compra_id','pedido_item_id','quantidade_recebida','data','nota_fiscal']},
  contrato_aditivos:{title:'Aditivos',label:'Aditivo',fields:[],editable:[],display:['contrato_id','descricao','status','valor_centavos','data','impacto_prazo_dias']}
};
const labels:Record<string,string>={pedido_compra_id:'Pedido',pedido_item_id:'Item do pedido',medicao_id:'Medição',quantidade_pedida:'Quantidade pedida',quantidade_recebida:'Quantidade recebida',quantidade_periodo:'Quantidade no período',quantidade_acumulada:'Acumulado',valor_periodo_centavos:'Valor no período',contrato_id:'Contrato',impacto_prazo_dias:'Impacto no prazo',nota_fiscal:'Nota fiscal',data:'Data',status:'Situação',clima:'Clima',atividades:'Atividades',observacoes:'Observações',descricao:'Descrição',tipo:'Tipo',responsavel:'Responsável',prazo:'Prazo',concluido_em:'Concluído em',quantidade:'Quantidade',unidade:'Unidade',codigo:'Código',valor_unitario_centavos:'Valor unitário',valor_bruto_centavos:'Valor bruto',valor_liquido_centavos:'Valor líquido',valor_centavos:'Valor',numero:'Número',competencia:'Competência',entrega_prevista:'Entrega prevista',solicitante:'Solicitante',prioridade:'Prioridade',titulo:'Título',categoria:'Categoria',versao:'Versão',status_assinatura:'Assinatura',vencimento:'Vencimento',data_inicio:'Início',data_fim:'Término'};
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));
const errorText=(e:unknown)=>{const x=e as {response?:{data?:{error?:string;message?:string}};message?:string};return x.response?.data?.error||x.response?.data?.message||x.message||'Não foi possível carregar.'};
const formatField=(field:string,value:unknown)=>{
  if(value===null||value===undefined||value==='')return '—';
  if(field.endsWith('_centavos')&&Number.isFinite(Number(value)))return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
  return String(value);
};
const itemTitle=(row:Row)=>String(row.payload.titulo||row.payload.descricao||row.payload.numero||row.payload.data||('Registro '+row.localId));
const labelField=(field:string)=>labels[field]||field;

const canCreateEntity=(entity:Entity,view:Overview)=>(['rdos','checklist_frente_itens','itens_orcamentarios','solicitacoes_compra'].includes(entity)||(isP1Domain(entity)&&view.capabilities?.finance===true));
export async function mountP1Management(root:HTMLElement,onBack:()=>void){
  let overview:Overview|null=null,active:Entity='rdos',editing=-1,expanded=-1,message='',busy=false,creating=false,selectedSource='',createNonce='';
  const load=async()=>{const result=await api.get<Overview>('/api/web/p1/overview');overview=result.data;editing=-1;expanded=-1;if(!overview.sources?.some(x=>x.deviceId===selectedSource))selectedSource=overview.sources?.[0]?.deviceId||'';};
  const draw=()=>{
    if(!overview)return;
    const view=overview,entries=view.items.filter(row=>row.entity===active),section=groups[active],edit=editing>=0?entries[editing]:null;
    const navigation=(Object.entries(groups) as Array<[Entity,typeof section]>).map(([entity,group])=>
      '<button type="button" data-p1-tab="'+entity+'" class="p0-tab'+(active===entity?' active':'')+'" aria-pressed="'+(active===entity)+'">'+escapeHtml(group.title)+' <span>'+view.items.filter(row=>row.entity===entity).length+'</span></button>').join('');
    const rows=entries.map((row,i)=>{
      const fields=section.display.filter(field=>row.payload[field]!==undefined).map(field=>
        '<div><dt>'+escapeHtml(labelField(field))+'</dt><dd>'+escapeHtml(formatField(field,row.payload[field]))+'</dd></div>').join('');
      return '<article class="p1-record"><div class="p1-record-head"><div><strong>'+escapeHtml(itemTitle(row))+'</strong><small>'+escapeHtml(String(row.payload.status||row.payload.categoria||'Registro publicado'))+' · Origem '+escapeHtml(row.sourceDeviceId)+'</small></div><div class="p1-record-actions">'+
        '<button data-p1-detail="'+i+'" type="button" class="p0-light" aria-expanded="'+(expanded===i)+'">Detalhes</button>'+
        (section.editable.length?'<button data-p1-edit="'+i+'" type="button" class="p0-light">Editar</button>':'')+
        '</div></div>'+(expanded===i?'<dl class="p1-details">'+fields+'</dl>':'')+'</article>';
    }).join('')||'<p class="p0-empty">Nenhum registro desta categoria foi publicado pela fonte operacional desta obra.</p>';
    const editFields=edit?section.editable.map(field=>{
      const value=String(edit.payload[field]??''),safe=escapeHtml(value),title=escapeHtml(labelField(field));
      if(field==='status')return '<label class="p0-field"><span>'+title+'</span><select name="status">'+
        ['pendente','em_andamento','em_execucao','bloqueado','concluido',...(!['pendente','em_andamento','em_execucao','bloqueado','concluido'].includes(value)?[value]:[])]
          .map(opt=>'<option value="'+escapeHtml(opt)+'"'+(opt===value?' selected':'')+'>'+escapeHtml(opt.replace(/_/g,' '))+'</option>').join('')+'</select></label>';
      if(field==='observacoes'||field==='atividades'||field==='descricao')return '<label class="p0-field"><span>'+title+'</span><textarea name="'+field+'" maxlength="'+(field==='descricao'?250:4000)+'">'+safe+'</textarea></label>';
      return '<label class="p0-field"><span>'+title+'</span><input name="'+field+'" value="'+safe+'" maxlength="250"'+(field==='prazo'?' type="date"':'')+'></label>';
    }).join(''):'';
    const canCreate=(['rdos','checklist_frente_itens','itens_orcamentarios','solicitacoes_compra'].includes(active)||(isP1Domain(active)&&view.capabilities?.finance===true))&&!!view.sources?.length;
    const sources=(view.sources||[]).map(source=>'<option value="'+escapeHtml(source.deviceId)+'"'+(selectedSource===source.deviceId?' selected':'')+'>'+escapeHtml(source.name)+'</option>').join('');
    const stages=(view.stages||[]).filter(x=>x.entity==='frentes_obra'&&x.sourceDeviceId===selectedSource);
    const stageSelect=stages.map(x=>'<option value="'+x.localId+'">'+escapeHtml(x.name)+'</option>').join('');
    const optionalStage='<label class="p0-field"><span>Etapa da obra (opcional)</span><select name="frente_id"><option value="">Sem etapa específica</option>'+stageSelect+'</select></label>';
    const createInputs=isP1Domain(active)?renderP1DomainFields(active,[...view.items,...(view.stages||[]).map(stage=>({entity:stage.entity,localId:stage.localId,sourceDeviceId:stage.sourceDeviceId,revision:0,desktopRevision:0,payload:{nome:stage.name}}))],selectedSource)
      :active==='rdos'
      ?'<label class="p0-field"><span>Data do RDO</span><input name="data" type="date" required></label><label class="p0-field"><span>Clima</span><input name="clima" maxlength="250"></label><label class="p0-field"><span>Atividades</span><textarea name="atividades" maxlength="4000"></textarea></label><label class="p0-field"><span>Observações</span><textarea name="observacoes" maxlength="4000"></textarea></label>'
      :active==='itens_orcamentarios'
      ?'<label class="p0-field"><span>Descrição do serviço/material</span><input name="descricao" maxlength="250" required></label>'+
        '<label class="p0-field"><span>Unidade</span><input name="unidade" maxlength="20" value="un" required></label>'+
        '<label class="p0-field"><span>Tipo</span><select name="tipo"><option value="material">Material</option><option value="mao_de_obra">Mão de obra</option><option value="equipamento">Equipamento</option><option value="servico">Serviço</option></select></label>'+
        '<label class="p0-field"><span>Quantidade</span><input type="number" name="quantidade" min="0" step="0.001" value="1" required></label>'+
        '<label class="p0-field"><span>Preço unitário (R$)</span><input type="number" name="valor_unitario_reais" min="0" step="0.01" value="0" required></label>'+optionalStage
      :active==='solicitacoes_compra'
      ?'<label class="p0-field"><span>Descrição do pedido</span><input name="descricao" maxlength="250" required></label>'+
        '<label class="p0-field"><span>Solicitante</span><input name="solicitante" maxlength="250" required></label>'+
        '<label class="p0-field"><span>Prazo</span><input type="date" name="prazo"></label>'+optionalStage
      :'<label class="p0-field"><span>Etapa da obra</span><select name="frente_id" required>'+stageSelect+'</select></label>'+
        '<label class="p0-field"><span>Descrição da vistoria</span><input name="descricao" maxlength="250" required></label>'+
        '<label class="p0-field"><span>Responsável</span><input name="responsavel" maxlength="250"></label>'+
        '<label class="p0-field"><span>Prazo</span><input name="prazo" type="date"></label>'+
        '<label class="p0-field"><span>Observações</span><textarea name="observacoes" maxlength="4000"></textarea></label>';
    const createForm=creating&&canCreate?'<form id="p1CreateForm" class="p0-editor"><h3>Novo '+escapeHtml(section.label)+'</h3><p>Solicitação idempotente. O registro só aparecerá após confirmação do Desktop ou servidor autorizado.</p>'+
      '<div class="p0-form-grid"><label class="p0-field"><span>Fonte operacional</span><select name="sourceDeviceId" id="p1Source">'+sources+'</select></label>'+createInputs+'</div>'+
      '<div class="p0-actions"><button id="p1CancelCreate" type="button" class="p0-light">Cancelar</button><button type="submit" class="p0-primary">Solicitar criação</button></div></form>':'';
    const pending=(view.commands||[]).filter(cmd=>['rdos','checklist_frente_itens','itens_orcamentarios','solicitacoes_compra','medicoes','pedidos_compra','recebimentos_materiais','movimentacoes_estoque','contratos_obra','contrato_aditivos'].includes(cmd.entity)).slice(0,10);
    const commandView=pending.length?'<div class="p0-editor"><h3>Solicitações recentes</h3>'+pending.map(cmd=>
      '<p>'+escapeHtml(cmd.entity==='rdos'?'RDO':cmd.entity==='checklist_frente_itens'?'Checklist':cmd.entity==='itens_orcamentarios'?'Orçamento':cmd.entity==='solicitacoes_compra'?'Solicitação de compra':cmd.entity)+': '+escapeHtml(cmd.status==='pending'?'Aguardando sincronização':cmd.status==='applied'?'Confirmado':'Falha: '+String(cmd.error||'Revisar registro'))+'</p>').join('')+'</div>':'';
    root.innerHTML='<section class="p0-layout p1-layout"><div class="p0-heading"><div><button type="button" class="p0-back" id="p1Back">Voltar à gestão</button><h1>Operação da obra · P1</h1><p>RDO, vistorias, orçamento, medições, compras, estoque, contratos e documentos no mesmo projeto operacional.</p></div><button type="button" id="p1Refresh" class="p0-light">Atualizar</button></div>'+
      '<div class="p0-context"><div><small>Empresa</small><strong>'+escapeHtml(view.company.name)+'</strong></div><div><small>Obra</small><strong>'+escapeHtml(view.project.name)+'</strong></div></div>'+
      '<div class="p0-notice"><strong>Dados canônicos · sem cópia operacional</strong><p>As informações são projeções sincronizadas do Desktop/servidor próprio. RDO e checklists permitem edição restrita. Medições, pedidos, recebimentos, movimentações, contratos e aditivos usam serviços transacionais da origem, com validação e idempotência. Arquivos documentais ainda exigem o armazenamento autorizado na fonte.</p></div>'+
      '<div class="p0-message" role="status" aria-live="polite">'+escapeHtml(message)+'</div>'+
      '<nav class="p0-tabs" aria-label="Módulos operacionais P1">'+navigation+'</nav>'+
      '<div class="p0-section-title"><h2>'+escapeHtml(section.title)+'</h2><small>'+entries.length+' registro(s) sincronizados</small>'+(canCreate?'<button type="button" id="p1Create" class="p0-primary">Novo '+escapeHtml(section.label)+'</button>':'')+'</div>'+
      (!section.editable.length&&!canCreate?'<p class="p1-readonly">Consulta da fonte operacional. Alterações deste módulo dependem do fluxo autorizado e do acesso correspondente.</p>':'')+
      '<div class="p0-list">'+rows+'</div>'+createForm+commandView+
      (edit?'<form class="p0-editor" id="p1EditForm"><h3>Editar '+escapeHtml(section.label)+'</h3><p>Proteção por revisão do Desktop e da Web: alterações concorrentes exigem recarregar os dados.</p><div class="p0-form-grid">'+editFields+'</div><div class="p0-actions"><button type="button" id="p1Cancel" class="p0-light">Cancelar</button><button type="submit" class="p0-primary"'+(busy?' disabled':'')+'>Salvar alteração</button></div></form>':'')+
      '</section>';
    root.querySelector<HTMLButtonElement>('#p1Back')?.addEventListener('click',onBack);
    root.querySelector<HTMLButtonElement>('#p1Refresh')?.addEventListener('click',()=>void refresh());
    root.querySelectorAll<HTMLButtonElement>('[data-p1-tab]').forEach(button=>button.addEventListener('click',()=>{active=button.dataset.p1Tab as Entity;editing=-1;expanded=-1;creating=false;createNonce='';message='';draw()}));
    root.querySelectorAll<HTMLButtonElement>('[data-p1-detail]').forEach(button=>button.addEventListener('click',()=>{expanded=expanded===Number(button.dataset.p1Detail)?-1:Number(button.dataset.p1Detail);draw()}));
    root.querySelectorAll<HTMLButtonElement>('[data-p1-edit]').forEach(button=>button.addEventListener('click',()=>{editing=Number(button.dataset.p1Edit);expanded=editing;message='';draw();root.querySelector('#p1EditForm')?.scrollIntoView?.({block:'nearest'})}));
    root.querySelector<HTMLButtonElement>('#p1Cancel')?.addEventListener('click',()=>{editing=-1;draw()});
    root.querySelector<HTMLButtonElement>('#p1Create')?.addEventListener('click',()=>{creating=true;editing=-1;createNonce='';draw()});
    root.querySelector<HTMLButtonElement>('#p1CancelCreate')?.addEventListener('click',()=>{creating=false;createNonce='';draw()});
    root.querySelector<HTMLSelectElement>('#p1Source')?.addEventListener('change',event=>{
      selectedSource=(event.target as HTMLSelectElement).value;createNonce='';draw();
    });
    root.querySelector<HTMLButtonElement>('#p1AddLine')?.addEventListener('click',()=>{const f=root.querySelector<HTMLFormElement>('#p1CreateForm');if(f)appendP1DomainLine(f)});
    root.querySelector<HTMLFormElement>('#p1CreateForm')?.addEventListener('submit',event=>{event.preventDefault();void submitCreate()});
    root.querySelector<HTMLFormElement>('#p1EditForm')?.addEventListener('submit',event=>{event.preventDefault();if(edit)void submit(edit)});
  };
  const refresh=async()=>{if(busy)return;try{await load();message='';draw()}catch(e){message=errorText(e);const area=root.querySelector('.p0-message');if(area)area.textContent=message}};
  const submitCreate=async()=>{
    if(busy||!overview||!creating||!selectedSource||!canCreateEntity(active,overview))return;
    const form=root.querySelector<HTMLFormElement>('#p1CreateForm');if(!form)return;
    let data:Record<string,unknown>;
    try{
      if(isP1Domain(active))data=parseP1DomainForm(active,form);
      else{
        const raw=new FormData(form);data={};
        for(const [key,value] of raw.entries()){
          if(key==='sourceDeviceId'||!String(value).trim())continue;
          const trimmed=String(value).trim();
          if(key==='valor_unitario_reais'){
            if(!/^\\d+(?:\\.\\d{1,2})?$/.test(trimmed))throw new Error('Preço unitário inválido.');
            data.valor_unitario_centavos=Math.round(Number(trimmed)*100);
          }else if(key==='quantidade')data.quantidade=Number(trimmed);
          else data[key]=key==='frente_id'?Number(trimmed):trimmed;
        }
      }
      if(data.frente_id&&!overview.stages?.some(stage=>stage.entity==='frentes_obra'&&stage.sourceDeviceId===selectedSource&&stage.localId===data.frente_id))
        throw new Error('Selecione uma etapa válida da origem selecionada.');
    }catch(error){message=errorText(error);const status=root.querySelector('.p0-message');if(status)status.textContent=message;return;}
    if(!createNonce)createNonce=crypto.randomUUID();
    busy=true;const button=form.querySelector<HTMLButtonElement>('button[type="submit"]');if(button)button.disabled=true;
    try{
      await api.post(isP1Domain(active)?'/api/web/p1/command':'/api/web/p0/create',
        {commandId:createNonce,entity:active,sourceDeviceId:selectedSource,data});
      creating=false;createNonce='';await load();message='Solicitação registrada. Aguardando confirmação da fonte operacional.';draw();
    }catch(error){message=errorText(error);const status=root.querySelector('.p0-message');if(status)status.textContent=message;if(button)button.disabled=false}
    finally{busy=false}
  };
  const submit=async(row:Row)=>{
    if(busy)return;
    const form=root.querySelector<HTMLFormElement>('#p1EditForm');if(!form)return;
    const input=new FormData(form),patch:Record<string,unknown>={};
    for(const key of groups[row.entity].editable){
      const value=String(input.get(key)||'').trim();
      if(value!==String(row.payload[key]??'').trim())patch[key]=value;
    }
    if(!Object.keys(patch).length){message='Nenhuma alteração encontrada.';draw();return}
    busy=true;
    const button=form.querySelector<HTMLButtonElement>('button[type="submit"]');if(button)button.disabled=true;
    try{
      await api.post('/api/web/p1/edit',{entity:row.entity,localId:row.localId,sourceDeviceId:row.sourceDeviceId,
        expectedRevision:row.revision,expectedDesktopRevision:row.desktopRevision,patch});
      await load();message='Alteração enviada para a fonte operacional. A confirmação aparecerá após sincronização.';draw();
    }catch(e){message=errorText(e);const status=root.querySelector('.p0-message');if(status)status.textContent=message;if(button)button.disabled=false}
    finally{busy=false;}
  };
  root.innerHTML='<section class="p0-layout"><p role="status">Carregando operação P1...</p></section>';
  try{await load();draw()}catch(e){
    root.innerHTML='<section class="p0-layout"><h1>Operação da obra P1</h1><p role="alert">'+escapeHtml(errorText(e))+'</p><button class="p0-light" id="p1Back">Voltar</button><button class="p0-primary" id="p1Retry">Tentar novamente</button></section>';
    root.querySelector('#p1Back')?.addEventListener('click',onBack);root.querySelector('#p1Retry')?.addEventListener('click',()=>void mountP1Management(root,onBack));
  }
}
