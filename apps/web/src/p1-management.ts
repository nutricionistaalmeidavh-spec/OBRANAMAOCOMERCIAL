import { api } from './cloudflare-client';
import './p0-management.css';
import './p1-management.css';

type Entity='rdos'|'checklist_frente_itens'|'itens_orcamentarios'|'medicoes'|'solicitacoes_compra'|'pedidos_compra'|'movimentacoes_estoque'|'contratos_obra'|'documentos';
type Row={entity:Entity;localId:number;sourceDeviceId:string;revision:number;desktopRevision:number;payload:Record<string,unknown>};
type Overview={
  company:{id:string;name:string};project:{id:string;name:string};
  topology:{mode:string};items:Row[];limitations:string[];
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
  documentos:{title:'Documentos e anexos',label:'Documento',fields:[],editable:[],display:['titulo','categoria','versao','status_assinatura','vencimento']}
};
const labels:Record<string,string>={data:'Data',status:'Situação',clima:'Clima',atividades:'Atividades',observacoes:'Observações',descricao:'Descrição',tipo:'Tipo',responsavel:'Responsável',prazo:'Prazo',concluido_em:'Concluído em',quantidade:'Quantidade',unidade:'Unidade',codigo:'Código',valor_unitario_centavos:'Valor unitário',valor_bruto_centavos:'Valor bruto',valor_liquido_centavos:'Valor líquido',valor_centavos:'Valor',numero:'Número',competencia:'Competência',entrega_prevista:'Entrega prevista',solicitante:'Solicitante',prioridade:'Prioridade',titulo:'Título',categoria:'Categoria',versao:'Versão',status_assinatura:'Assinatura',vencimento:'Vencimento',data_inicio:'Início',data_fim:'Término'};
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));
const errorText=(e:unknown)=>{const x=e as {response?:{data?:{error?:string;message?:string}};message?:string};return x.response?.data?.error||x.response?.data?.message||x.message||'Não foi possível carregar.'};
const formatField=(field:string,value:unknown)=>{
  if(value===null||value===undefined||value==='')return '—';
  if(field.endsWith('_centavos')&&Number.isFinite(Number(value)))return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
  return String(value);
};
const itemTitle=(row:Row)=>String(row.payload.titulo||row.payload.descricao||row.payload.numero||row.payload.data||('Registro '+row.localId));
const labelField=(field:string)=>labels[field]||field;

export async function mountP1Management(root:HTMLElement,onBack:()=>void){
  let overview:Overview|null=null,active:Entity='rdos',editing=-1,expanded=-1,message='',busy=false;
  const load=async()=>{const result=await api.get<Overview>('/api/web/p1/overview');overview=result.data;editing=-1;expanded=-1;};
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
    root.innerHTML='<section class="p0-layout p1-layout"><div class="p0-heading"><div><button type="button" class="p0-back" id="p1Back">Voltar à gestão</button><h1>Operação da obra · P1</h1><p>RDO, vistorias, orçamento, medições, compras, estoque, contratos e documentos no mesmo projeto operacional.</p></div><button type="button" id="p1Refresh" class="p0-light">Atualizar</button></div>'+
      '<div class="p0-context"><div><small>Empresa</small><strong>'+escapeHtml(view.company.name)+'</strong></div><div><small>Obra</small><strong>'+escapeHtml(view.project.name)+'</strong></div></div>'+
      '<div class="p0-notice"><strong>Dados canônicos · sem cópia operacional</strong><p>As informações são projeções sincronizadas do Desktop/servidor próprio. RDO e checklist permitem edição restrita, aplicada na origem após sincronização. Lançamentos de orçamento, medição, compra, estoque, contratos e arquivos continuam somente leitura aqui para preservar regras financeiras, documentos e movimentações.</p></div>'+
      '<div class="p0-message" role="status" aria-live="polite">'+escapeHtml(message)+'</div>'+
      '<nav class="p0-tabs" aria-label="Módulos operacionais P1">'+navigation+'</nav>'+
      '<div class="p0-section-title"><h2>'+escapeHtml(section.title)+'</h2><small>'+entries.length+' registro(s) sincronizados</small></div>'+
      (!section.editable.length?'<p class="p1-readonly">Este módulo está em modo somente leitura. Alterações devem ser feitas pelo fluxo canônico do Desktop/servidor até a liberação das operações transacionais Web.</p>':'')+
      '<div class="p0-list">'+rows+'</div>'+
      (edit?'<form class="p0-editor" id="p1EditForm"><h3>Editar '+escapeHtml(section.label)+'</h3><p>Proteção por revisão do Desktop e da Web: alterações concorrentes exigem recarregar os dados.</p><div class="p0-form-grid">'+editFields+'</div><div class="p0-actions"><button type="button" id="p1Cancel" class="p0-light">Cancelar</button><button type="submit" class="p0-primary"'+(busy?' disabled':'')+'>Salvar alteração</button></div></form>':'')+
      '</section>';
    root.querySelector<HTMLButtonElement>('#p1Back')?.addEventListener('click',onBack);
    root.querySelector<HTMLButtonElement>('#p1Refresh')?.addEventListener('click',()=>void refresh());
    root.querySelectorAll<HTMLButtonElement>('[data-p1-tab]').forEach(button=>button.addEventListener('click',()=>{active=button.dataset.p1Tab as Entity;editing=-1;expanded=-1;message='';draw()}));
    root.querySelectorAll<HTMLButtonElement>('[data-p1-detail]').forEach(button=>button.addEventListener('click',()=>{expanded=expanded===Number(button.dataset.p1Detail)?-1:Number(button.dataset.p1Detail);draw()}));
    root.querySelectorAll<HTMLButtonElement>('[data-p1-edit]').forEach(button=>button.addEventListener('click',()=>{editing=Number(button.dataset.p1Edit);expanded=editing;message='';draw();root.querySelector('#p1EditForm')?.scrollIntoView?.({block:'nearest'})}));
    root.querySelector<HTMLButtonElement>('#p1Cancel')?.addEventListener('click',()=>{editing=-1;draw()});
    root.querySelector<HTMLFormElement>('#p1EditForm')?.addEventListener('submit',event=>{event.preventDefault();if(edit)void submit(edit)});
  };
  const refresh=async()=>{if(busy)return;try{await load();message='';draw()}catch(e){message=errorText(e);const area=root.querySelector('.p0-message');if(area)area.textContent=message}};
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
