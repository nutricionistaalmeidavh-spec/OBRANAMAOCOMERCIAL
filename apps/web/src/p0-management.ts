
import { api } from './cloudflare-client';
import './p0-management.css';
import {parentStage,stageIsDelayed} from './p0-hierarchy';

type Entity='clientes'|'obras'|'frentes_obra'|'subfrentes_obra'|'tarefas_obra'|'cronograma_etapas';
type P0CreateEntity=Exclude<Entity,'cronograma_etapas'>;
type Entry={entity:Entity;localId:number;sourceDeviceId:string;revision:number;desktopRevision?:number;payload:Record<string,unknown>};
type Overview={
  company:{id:string;name:string};project:{id:string;name:string;customer:string};
  source:'desktop-bridge';revision:number;topology:{mode:string};items:Entry[];limitations:string[];
  sources?:Array<{deviceId:string;name:string}>;
  commands?:Array<{id:string;entity:string;deviceId:string;status:'pending'|'applied'|'failed';localId?:number;error?:string;createdAt:string}>;
};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));
const groups:Record<Entity,{title:string;singular:string;fields:string[]}> = {
  clientes:{title:'Clientes',singular:'Cliente',fields:[]},
  obras:{title:'Obras',singular:'Obra',fields:[]},
  frentes_obra:{title:'Etapas',singular:'Etapa',fields:['nome','codigo','status','observacoes']},
  subfrentes_obra:{title:'Subetapas',singular:'Subetapa',fields:['nome','codigo','pavimento','escopo','status','observacoes']},
  tarefas_obra:{title:'Tarefas',singular:'Tarefa',fields:['titulo','descricao','status','responsavel','prazo','prioridade','observacoes','concluido_em']},
  cronograma_etapas:{title:'Cronograma',singular:'Prazo',fields:['status','percentual_realizado','responsavel','previsto_inicio','previsto_fim','observacoes']}
};
const labels:Record<string,string>={documento:'Documento',telefone:'Telefone',email:'E-mail',endereco:'Endereço',cliente_id:'Cliente vinculado',data_inicio:'Início da obra',previsao_termino:'Previsão de término',nome:'Nome',codigo:'Código',pavimento:'Pavimento',escopo:'Escopo',titulo:'Título',descricao:'Descrição',status:'Situação',responsavel:'Responsável',prazo:'Prazo',prioridade:'Prioridade',observacoes:'Observações',concluido_em:'Concluído em',percentual_realizado:'Realizado (%)',previsto_inicio:'Início previsto',previsto_fim:'Fim previsto'};
const errorText=(cause:unknown)=>{const x=cause as {response?:{status?:number;data?:{error?:string}};message?:string};return x.response?.data?.error||x.message||'Não foi possível concluir.'};
const itemTitle=(item:Entry)=>String(item.payload.titulo||item.payload.nome||item.payload.descricao||('Registro '+item.localId));
const short=(value:unknown)=>{const x=String(value??'');return x.length>150?x.slice(0,147)+'...':x};

export async function mountP0Management(root:HTMLElement,onBack:()=>void){
  let data:Overview|null=null,tab:Entity='frentes_obra',editIndex=-1,deleteIndex=-1,message='',busy=false,createMode=false;
  let createNonce='',selectedSource='';

  const load=async()=>{
    const result=await api.get<Overview>('/api/web/p0/overview');
    data=result.data;editIndex=-1;
    if(!data.sources?.some(x=>x.deviceId===selectedSource))selectedSource=data.sources?.[0]?.deviceId||'';
  };

  const draw=()=>{
    if(!data)return;
    const snapshot=data,records=snapshot.items.filter(row=>row.entity===tab);
    const selected=editIndex>=0?records[editIndex]:null,deleteSelected=deleteIndex>=0?records[deleteIndex]:null;
    const createEnabled=tab!=='cronograma_etapas'&&!!snapshot.sources?.length;
    const createFields:Record<P0CreateEntity,string[]>={
      clientes:['nome','documento','telefone','email','observacoes'],
      obras:['nome','cliente_id','codigo','endereco','responsavel','data_inicio','previsao_termino','status','observacoes'],
      frentes_obra:['nome','codigo','status','observacoes'],
      subfrentes_obra:['frente_id','nome','pavimento','escopo','status'],
      tarefas_obra:['frente_id','titulo','descricao','responsavel','prazo','status']
    };
    const stages=snapshot.items.filter(item=>item.entity==='frentes_obra'&&item.sourceDeviceId===selectedSource);
    const clients=snapshot.items.filter(item=>item.entity==='clientes'&&item.sourceDeviceId===selectedSource);
    const sourceOptions=(snapshot.sources||[]).map(item=>'<option value="'+esc(item.deviceId)+'" '+(item.deviceId===selectedSource?'selected':'')+'>'+esc(item.name)+'</option>').join('');
    const createInputs=createMode&&createEnabled?createFields[tab as P0CreateEntity].map(field=>{
      if(field==='cliente_id')return '<label class="p0-field"><span>Cliente</span><select name="cliente_id"><option value="">Não vinculado</option>'+clients.map(x=>'<option value="'+x.localId+'">'+esc(itemTitle(x))+'</option>').join('')+'</select></label>';
      if(field==='frente_id')return '<label class="p0-field"><span>Etapa vinculada</span><select name="frente_id" '+(tab==='subfrentes_obra'?'required':'')+'>'+(tab==='tarefas_obra'?'<option value="">Sem etapa</option>':'')+stages.map(item=>'<option value="'+item.localId+'">'+esc(itemTitle(item))+'</option>').join('')+'</select></label>';
      const required=field===(tab==='tarefas_obra'?'titulo':'nome')?'required':'';
      return '<label class="p0-field"><span>'+esc(labels[field]||field)+'</span><input name="'+field+'" maxlength="4000" '+required+'></label>';
    }).join(''):'';
    const now=new Date(),today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const schedule=snapshot.items.filter(row=>row.entity==='cronograma_etapas');
    const stageDelay=(item:Entry)=>schedule.some(row=>row.sourceDeviceId===item.sourceDeviceId&&Number(row.payload.frente_id)===item.localId&&stageIsDelayed(row.payload,today));
    const parent=(item:Entry)=>['subfrentes_obra','tarefas_obra','cronograma_etapas'].includes(item.entity)?parentStage(item,snapshot.items):'';
    const nav=Object.entries(groups).map(([key,section])=>'<button type="button" class="p0-tab'+(tab===key?' active':'')+'" data-p0-tab="'+key+'" aria-pressed="'+(tab===key)+'">'+esc(section.title)+' <span>'+snapshot.items.filter(row=>row.entity===key).length+'</span></button>').join('');
    const rows=records.length?records.map((item,index)=>
      '<article class="p0-item"><div class="p0-item-main"><strong>'+esc(itemTitle(item))+'</strong>'+
      '<small>'+esc(short(item.payload.status||'Sem status'))+' · ID '+item.localId+' · rev. '+item.revision+(parent(item)?' · Etapa: '+esc(parent(item)):'')+(item.entity==='frentes_obra'&&stageDelay(item)?' · Atrasada no cronograma':'')+'</small></div>'+
      (groups[item.entity].fields.length?'<button type="button" data-p0-edit="'+index+'" class="p0-light">Editar</button>':'')+
      (item.payload.sourceFingerprint?'<button type="button" data-p0-delete="'+index+'" class="p0-light">Excluir</button>':'')+'</article>'
    ).join(''):'<p class="p0-empty">Nenhum registro do Desktop sincronizado nesta área. Os cadastros existentes permanecem na fonte operacional.</p>';
    const fields=selected?groups[tab].fields.map(field=>{
      const value=selected.payload[field];
      return '<label class="p0-field"><span>'+esc(labels[field]||field)+'</span><input name="'+field+'" value="'+esc(value??'')+'" maxlength="4000" '+(field==='percentual_realizado'?'inputmode="decimal"':'')+'></label>';
    }).join(''):'';
    root.innerHTML=
      '<section class="p0-layout"><div class="p0-heading"><div><button type="button" id="p0Back" class="p0-back">Voltar à Gestão</button><h1>Operação da obra</h1><p>Consulta e edição dos registros publicados pelo Desktop, sem duplicar cadastros.</p></div><button id="p0Refresh" type="button" class="p0-light">Atualizar</button></div>'+
      '<div class="p0-context"><div><small>Empresa</small><strong>'+esc(snapshot.company.name)+'</strong></div><div><small>Obra vinculada</small><strong>'+esc(snapshot.project.name)+'</strong></div><div><small>Cliente da obra</small><strong>'+esc(snapshot.project.customer||'Não informado')+'</strong></div><div><small>Origem operacional</small><strong>'+esc(snapshot.topology.mode==='local-single'?'Desktop local + sincronização':snapshot.topology.mode==='remote'?'Servidor remoto':'Servidor próprio / LAN')+'</strong></div></div>'+
      '<div class="p0-notice"><strong>Fonte de dados preservada</strong><p>Clientes e obras continuam cadastrados no Desktop/Server. Clientes, obras, etapas, subetapas e tarefas podem ser solicitados aqui via Desktop ou servidor próprio autorizado. A criação só é efetivada no SQLite e aparece após sincronização. Não foi criado um banco paralelo.</p></div>'+
      '<div role="status" aria-live="polite" class="p0-message">'+esc(message)+'</div>'+
      '<nav aria-label="Seções da operação" class="p0-tabs">'+nav+'</nav>'+
      '<div class="p0-section-title"><h2>'+esc(groups[tab].title)+'</h2><small>'+records.length+' registro(s) publicados</small>'+(createEnabled?'<button type="button" id="p0Create" class="p0-primary">Nova '+esc(groups[tab].singular.toLowerCase())+'</button>':'')+'</div><div class="p0-list">'+rows+'</div>'+
      (deleteSelected?'<form id="p0DeleteForm" class="p0-editor"><h3>Excluir '+esc(groups[deleteSelected.entity].singular)+'</h3><p>Esta operação solicita exclusão lógica na fonte operacional. Se o cadastro tiver dependências ou tiver sido atualizado, a exclusão será bloqueada.</p><p><strong>'+esc(itemTitle(deleteSelected))+'</strong> · ID '+deleteSelected.localId+'</p><label class="p0-field"><span>Digite EXCLUIR para confirmar</span><input name="confirmation" autocomplete="off" required></label><div class="p0-actions"><button id="p0CancelDelete" type="button" class="p0-light">Cancelar</button><button type="submit" class="p0-primary" '+(busy?'disabled':'')+'>Confirmar exclusão</button></div></form>':'')+
      (createMode&&createEnabled?'<form id="p0CreateForm" class="p0-editor"><h3>Nova '+esc(groups[tab].singular)+'</h3><p>Será criada na fonte operacional pelo Desktop autorizado. Enquanto estiver desligado, a solicitação ficará pendente.</p><label class="p0-field"><span>Desktop responsável</span><select id="p0Source" name="sourceDeviceId">'+sourceOptions+'</select></label><div class="p0-form-grid">'+createInputs+'</div><div class="p0-actions"><button type="button" id="p0CancelCreate" class="p0-light">Cancelar</button><button class="p0-primary" type="submit" '+(busy?'disabled':'')+'>Solicitar criação</button></div></form>':'')+
      ((snapshot.commands||[]).length?'<div class="p0-editor"><h3>Solicitações recentes</h3>'+(snapshot.commands||[]).slice(0,10).map(x=>'<div class="p0-item"><strong>'+esc(groups[x.entity as Entity]?.singular||x.entity)+'</strong><small>'+esc(x.status==='pending'?'Aguardando Desktop':x.status==='applied'?'Criado no Desktop, ID '+x.localId:'Falha: '+(x.error||'Revisar comando'))+'</small></div>').join('')+'</div>':'')+
      (selected?'<form id="p0EditForm" class="p0-editor"><h3>Editar '+esc(groups[tab].singular)+'</h3><p>Alterações são enviadas à ponte de sincronização e serão recebidas pelo Desktop conectado.</p><div class="p0-form-grid">'+fields+'</div><div class="p0-actions"><button type="button" id="p0Cancel" class="p0-light">Cancelar</button><button class="p0-primary" type="submit" '+(busy?'disabled':'')+'>'+ (busy?'Salvando...':'Salvar alterações')+'</button></div></form>':'')+
      '</section>';

    root.querySelector('#p0Back')?.addEventListener('click',onBack);
    root.querySelector('#p0Refresh')?.addEventListener('click',()=>void refresh());
    root.querySelectorAll<HTMLButtonElement>('[data-p0-tab]').forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.p0Tab as Entity;editIndex=-1;deleteIndex=-1;createMode=false;createNonce='';message='';draw()}));
    root.querySelectorAll<HTMLButtonElement>('[data-p0-edit]').forEach(button=>button.addEventListener('click',()=>{editIndex=Number(button.dataset.p0Edit);message='';draw();root.querySelector<HTMLElement>('#p0EditForm')?.scrollIntoView?.({block:'nearest'});}));
    root.querySelector('#p0Cancel')?.addEventListener('click',()=>{editIndex=-1;draw()});
    root.querySelector('#p0Create')?.addEventListener('click',()=>{createMode=true;deleteIndex=-1;editIndex=-1;createNonce='';draw();root.querySelector('#p0CreateForm')?.scrollIntoView?.({block:'nearest'})});
    root.querySelector('#p0CancelCreate')?.addEventListener('click',()=>{createMode=false;createNonce='';draw()});
    root.querySelector('#p0Source')?.addEventListener('change',event=>{selectedSource=(event.target as HTMLSelectElement).value;draw()});
    root.querySelector('#p0CreateForm')?.addEventListener('submit',event=>{event.preventDefault();void submitCreate()});
    root.querySelectorAll<HTMLButtonElement>('[data-p0-delete]').forEach(button=>button.addEventListener('click',()=>{
      deleteIndex=Number(button.dataset.p0Delete);editIndex=-1;createMode=false;createNonce='';message='';draw();root.querySelector('#p0DeleteForm')?.scrollIntoView?.({block:'nearest'})
    }));
    root.querySelector('#p0CancelDelete')?.addEventListener('click',()=>{deleteIndex=-1;createNonce='';draw()});
    root.querySelector('#p0DeleteForm')?.addEventListener('submit',event=>{event.preventDefault();void submitDelete()});
    root.querySelector('#p0EditForm')?.addEventListener('submit',event=>{event.preventDefault();void submit(selected!)});
  };

  const refresh=async()=>{
    try{message='';await load();draw()}catch(cause){message=errorText(cause);draw();}
  };
  const submitCreate=async()=>{
    if(busy||tab==='cronograma_etapas'||!selectedSource)return;
    const form=root.querySelector<HTMLFormElement>('#p0CreateForm');if(!form)return;
    const fields=new FormData(form),value:Record<string,unknown>={};
    for(const [key,raw] of fields){
      if(key==='sourceDeviceId')continue;
      const str=String(raw).trim();if(!str)continue;
      value[key]=key==='frente_id'||key==='cliente_id'?Number(str):str;
    }
    if(!createNonce)createNonce=crypto.randomUUID();
    const commandId=createNonce,entity=tab,sourceDeviceId=selectedSource;
    busy=true;
    const button=form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if(button)button.disabled=true;
    try{
      await api.post('/api/web/p0/create',{commandId,entity,sourceDeviceId,data:value});
      createMode=false;createNonce='';await load();
      message='Solicitação registrada. Aguardando confirmação do Desktop para aparecer na obra.';
      draw();
    }catch(cause){
      message=errorText(cause);
      const live=root.querySelector('.p0-message');if(live)live.textContent=message;
      if(button)button.disabled=false;
    }finally{busy=false}
  };

  const submitDelete=async()=>{
    if(busy||!data||deleteIndex<0)return;
    const row=data.items.filter(item=>item.entity===tab)[deleteIndex],form=root.querySelector<HTMLFormElement>('#p0DeleteForm');
    if(!row||!form)return;
    if(String(new FormData(form).get('confirmation')||'').trim()!=='EXCLUIR'){
      message='Digite exatamente EXCLUIR para confirmar.';
      const live=root.querySelector('.p0-message');if(live)live.textContent=message;
      return;
    }
    if(!createNonce)createNonce=crypto.randomUUID();
    busy=true;
    const button=form.querySelector<HTMLButtonElement>('button[type="submit"]');if(button)button.disabled=true;
    try{
      await api.post('/api/web/p0/delete',{
        commandId:createNonce,entity:row.entity,sourceDeviceId:row.sourceDeviceId,
        localId:row.localId,expectedFingerprint:String(row.payload.sourceFingerprint||'')
      });
      deleteIndex=-1;createNonce='';await load();message='Exclusão solicitada. Aguardando confirmação da fonte operacional.';draw();
    }catch(cause){
      message=errorText(cause);const live=root.querySelector('.p0-message');if(live)live.textContent=message;
      if(button)button.disabled=false;
    }finally{busy=false}
  };

  const submit=async(row:Entry)=>{
    if(busy)return;
    const form=root.querySelector<HTMLFormElement>('#p0EditForm');if(!form)return;
    const values=new FormData(form),patch:Record<string,string>={};
    for(const field of groups[row.entity].fields){
      const value=String(values.get(field)||'').trim();
      if(value!==String(row.payload[field]??'').trim())patch[field]=value;
    }
    if(!Object.keys(patch).length){message='Nenhuma alteração para salvar.';draw();return}
    busy=true;message='';
    // Keep the form mounted during the request; preserve the draft on 409.
    const submitButton=form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if(submitButton){submitButton.disabled=true;submitButton.textContent='Salvando...'}
    try{
      await api.post('/api/web/p0/edit',{entity:row.entity,localId:row.localId,sourceDeviceId:row.sourceDeviceId,expectedRevision:row.revision,expectedDesktopRevision:row.desktopRevision||0,patch});
      await load();message='Alterações salvas para sincronização com o Desktop.';draw();
    }catch(cause){
      message=errorText(cause)+' Confira a revisão atual antes de tentar novamente.';
      const live=root.querySelector('.p0-message');if(live)live.textContent=message;
      if(submitButton){submitButton.disabled=false;submitButton.textContent='Salvar alterações'}
    }finally{busy=false}
  };

  root.innerHTML='<section class="p0-layout"><p role="status">Carregando registros integrados da obra...</p></section>';
  try{await load();draw()}catch(cause){
    root.innerHTML='<section class="p0-layout"><h1>Operação da obra</h1><p role="alert">'+esc(errorText(cause))+'</p><button id="p0Back" type="button" class="p0-light">Voltar à Gestão</button><button id="p0Retry" type="button" class="p0-primary">Tentar novamente</button></section>';
    root.querySelector('#p0Back')?.addEventListener('click',onBack);
    root.querySelector('#p0Retry')?.addEventListener('click',()=>void mountP0Management(root,onBack));
  }
}
