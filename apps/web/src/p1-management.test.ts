// @vitest-environment happy-dom
import { beforeEach,describe,expect,it,vi } from 'vitest';
const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('./cloudflare-client',()=>({api:client}));
import { mountP1Management } from './p1-management';

const sample=()=>({
  company:{id:'company-a',name:'Construtora A'},project:{id:'work-a',name:'Obra Norte'},topology:{mode:'remote'},
  items:[
    {entity:'rdos',localId:5,sourceDeviceId:'pc-1',revision:2,desktopRevision:7,payload:{data:'2026-11-19',status:'rascunho',clima:'Sol',atividades:'Concretagem',observacoes:'Sem ocorrências'}},
    {entity:'checklist_frente_itens',localId:6,sourceDeviceId:'pc-1',revision:2,desktopRevision:7,payload:{descricao:'Vistoria',status:'pendente',responsavel:'João',prazo:'2026-11-21'}},
    {entity:'contratos_obra',localId:8,sourceDeviceId:'pc-1',revision:0,desktopRevision:2,payload:{descricao:'Contrato principal',valor_centavos:12345}},
    {entity:'documentos',localId:9,sourceDeviceId:'pc-1',revision:0,desktopRevision:2,payload:{titulo:'Projeto executivo',categoria:'projeto'}}
  ],
  limitations:[]
});
describe('Gestão Web P1',()=>{
  beforeEach(()=>{vi.clearAllMocks();document.body.innerHTML='<main id="content"></main>';client.get.mockResolvedValue({data:sample()});client.post.mockResolvedValue({data:{ok:true}})});
  it('exibe módulos operacionais e detalhes sem oferecer escrita financeira direta',async()=>{
    const root=document.getElementById('content')!;
    await mountP1Management(root,()=>{});
    expect(root.textContent).toContain('Construtora A');
    expect(root.textContent).toContain('RDO');
    root.querySelector<HTMLButtonElement>('[data-p1-tab="contratos_obra"]')!.click();
    expect(root.textContent).toContain('Contrato principal');
    expect(root.querySelector('[data-p1-edit]')).toBeNull();
    expect(root.textContent).toContain('somente leitura');
    expect(client.get).toHaveBeenCalledWith('/api/web/p1/overview');
  });
  it('edita checklist com CAS, sem gravar banco Web paralelo',async()=>{
    const root=document.getElementById('content')!;
    await mountP1Management(root,()=>{});
    root.querySelector<HTMLButtonElement>('[data-p1-tab="checklist_frente_itens"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-p1-edit="0"]')!.click();
    root.querySelector<HTMLSelectElement>('#p1EditForm [name="status"]')!.value='concluido';
    root.querySelector<HTMLFormElement>('#p1EditForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/web/p1/edit',{
      entity:'checklist_frente_itens',localId:6,sourceDeviceId:'pc-1',expectedRevision:2,expectedDesktopRevision:7,patch:{status:'concluido'}
    }));
  });
  it('não interpreta texto remoto como HTML executável',async()=>{
    client.get.mockResolvedValue({data:{...sample(),items:[{entity:'rdos',localId:1,sourceDeviceId:'pc-1',revision:0,desktopRevision:2,payload:{atividades:'<img src=x onerror=alert(1)>'}}]}});
    const root=document.getElementById('content')!;
    await mountP1Management(root,()=>{});
    root.querySelector<HTMLButtonElement>('[data-p1-detail="0"]')!.click();
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
  });
});
