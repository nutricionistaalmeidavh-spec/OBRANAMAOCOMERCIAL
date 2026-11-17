
import { api } from './cloudflare-client';
import './p0-management.css';
import {parentStage,stageIsDelayed} from './p0-hierarchy';

type Entity='frentes_obra'|'subfrentes_obra'|'tarefas_obra'|'cronograma_etapas';
type Entry={entity:Entity;localId:number;sourceDeviceId:string;revision:number;desktopRevision?:number;payload:Record<string,unknown>};
type Overview={
  company:{id:string;name:string};project:{id:string;name:string;customer:string};
  source:'desktop-bridge';revision:number;topology:{mode:string};items:Entry[];limitations:string[];
};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));
const groups:Record<Entity,{title:string;singular:string;fields:string[]}> = {
  frentes_obra:{title:'Etapas',singular:'Etapa',fields:['nome','codigo','status','observacoes']},
  subfrentes_obra:{title:'Subetapas',singular:'Subetapa',fields:['nome','codigo','pavimento','escopo','status','observacoes']},
  tarefas_obra:{title:'Tarefas',singular:'Tarefa',fields:['titulo','descricao','status','responsavel','prazo','prioridade','observacoes','concluido_em']},
  cronograma_etapas:{title:'Cronograma',singular:'Prazo',fields:['status','percentual_realizado','responsavel','previsto_inicio','previsto_fim','observacoes']}
};
const labels:Record<string,string>={nome:'Nome',codigo:'Código',pavimento:'Pavimento',escopo:'Escopo',titulo:'Título',descricao:'Descrição',status:'Situação',responsavel:'Responsável',prazo:'Prazo',prioridade:'Prioridade',observacoes:'Observações',concluido_em:'Concluído em',percentual_realizado:'Realizado (%)',previsto_inicio:'Início previsto',previsto_fim:'Fim previsto'};
const errorText=(cause:unknown)=>{const x=cause as {response?:{status?:number;data?:{error?:string}};message?:string};return x.response?.data?.error||x.message||'Não foi possível concluir.'};
const itemTitle=(item:Entry)=>String(item.payload.titulo||item.payload.nome||item.payload.descricao||('Registro '+item.localId));
const short=(value:unknown)=>{const x=String(value??'');return x.length>150?x.slice(0,147)+'...':x};

export async function mountP0Management(root:HTMLElement,onBack:()=>void){
  let data:Overview|null=null,tab:Entity='frentes_obra',editIndex=-1,message='',busy=false;

  const load=async()=>{
    const result=await api.get<Overview>('/api/web/p0/overview');
    data=result.data;editIndex=-1;
  };

  const draw=()=>{
    if(!data)return;
    const snapshot=data,records=snapshot.items.filter(row=>row.entity===tab);
    const selected=editIndex>=0?records[editIndex]:null;
    const today=new Date().toLocaleDateString('en-CA');
    const schedule=snapshot.items.filter(row=>row.entity==='cronograma_etapas');
    const stageDelay=(item:Entry)=>schedule.some(row=>row.sourceDeviceId===item.sourceDeviceId&&Number(row.payload.frente_id)===item.localId&&stageIsDelayed(row.payload,today));
    const parent=(item:Entry)=>item.entity==='frentes_obra'?'':parentStage(item,snapshot.items);
    const nav=Object.entries(groups).map(([key,section])=>'<button type="button" class="p0-tab'+(tab===key?' active':'')+'" data-p0-tab="'+key+'" aria-pressed="'+(tab===key)+'">'+esc(section.title)+' <span>'+snapshot.items.filter(row=>row.entity===key).length+'</span></button>').join('');
    const rows=records.length?records.map((item,index)=>
      '<article class="p0-item"><div class="p0-item-main"><strong>'+esc(itemTitle(item))+'</strong>'+
      '<small>'+esc(short(item.payload.status||'Sem status'))+' · ID '+item.localId+' · rev. '+item.revision+(item.entity!=='frentes_obra'?' · Etapa: '+esc(parent(item)):'')+(item.entity==='frentes_obra'&&stageDelay(item)?' · Atrasada no cronograma':'')+'</small></div>'+
      '<button type="button" data-p0-edit="'+index+'" class="p0-light">Editar</button></article>'
    ).join(''):'<p class="p0-empty">Nenhum registro do Desktop sincronizado nesta área. Os cadastros existentes permanecem na fonte operacional.</p>';
    const fields=selected?groups[tab].fields.map(field=>{
      const value=selected.payload[field];
      return '<label class="p0-field"><span>'+esc(labels[field]||field)+'</span><input name="'+field+'" value="'+esc(value??'')+'" maxlength="4000" '+(field==='percentual_realizado'?'inputmode="decimal"':'')+'></label>';
    }).join(''):'';
    root.innerHTML=
      '<section class="p0-layout"><div class="p0-heading"><div><button type="button" id="p0Back" class="p0-back">Voltar à Gestão</button><h1>Operação da obra</h1><p>Consulta e edição dos registros publicados pelo Desktop, sem duplicar cadastros.</p></div><button id="p0Refresh" type="button" class="p0-light">Atualizar</button></div>'+
      '<div class="p0-context"><div><small>Empresa</small><strong>'+esc(snapshot.company.name)+'</strong></div><div><small>Obra vinculada</small><strong>'+esc(snapshot.project.name)+'</strong></div><div><small>Cliente da obra</small><strong>'+esc(snapshot.project.customer||'Não informado')+'</strong></div><div><small>Origem operacional</small><strong>'+esc(snapshot.topology.mode==='local-single'?'Desktop local + sincronização':snapshot.topology.mode==='remote'?'Servidor remoto':'Servidor próprio / LAN')+'</strong></div></div>'+
      '<div class="p0-notice"><strong>Fonte de dados preservada</strong><p>Novas empresas, clientes, obras, etapas e subetapas ainda precisam ser cadastrados no Desktop/Server. A edição das subetapas sincronizadas já está disponível aqui. Aqui são exibidos apenas registros integrados, com controle de revisão para edição. Não foi criado um banco paralelo.</p></div>'+
      '<div role="status" aria-live="polite" class="p0-message">'+esc(message)+'</div>'+
      '<nav aria-label="Seções da operação" class="p0-tabs">'+nav+'</nav>'+
      '<div class="p0-section-title"><h2>'+esc(groups[tab].title)+'</h2><small>'+records.length+' registro(s) publicados</small></div><div class="p0-list">'+rows+'</div>'+
      (selected?'<form id="p0EditForm" class="p0-editor"><h3>Editar '+esc(groups[tab].singular)+'</h3><p>Alterações são enviadas à ponte de sincronização e serão recebidas pelo Desktop conectado.</p><div class="p0-form-grid">'+fields+'</div><div class="p0-actions"><button type="button" id="p0Cancel" class="p0-light">Cancelar</button><button class="p0-primary" type="submit" '+(busy?'disabled':'')+'>'+ (busy?'Salvando...':'Salvar alterações')+'</button></div></form>':'')+
      '</section>';

    root.querySelector('#p0Back')?.addEventListener('click',onBack);
    root.querySelector('#p0Refresh')?.addEventListener('click',()=>void refresh());
    root.querySelectorAll<HTMLButtonElement>('[data-p0-tab]').forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.p0Tab as Entity;editIndex=-1;message='';draw()}));
    root.querySelectorAll<HTMLButtonElement>('[data-p0-edit]').forEach(button=>button.addEventListener('click',()=>{editIndex=Number(button.dataset.p0Edit);message='';draw();root.querySelector<HTMLElement>('#p0EditForm')?.scrollIntoView?.({block:'nearest'});}));
    root.querySelector('#p0Cancel')?.addEventListener('click',()=>{editIndex=-1;draw()});
    root.querySelector('#p0EditForm')?.addEventListener('submit',event=>{event.preventDefault();void submit(selected!)});
  };

  const refresh=async()=>{
    try{message='';await load();draw()}catch(cause){message=errorText(cause);draw();}
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
