// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('./cloudflare-client',()=>({api:client}));
import { mountP0Management } from './p0-management';

const overview=()=>({
  company:{id:'company-a',name:'Construtora A'},
  project:{id:'project-a',name:'Obra Central',customer:'Cliente A'},
  source:'desktop-bridge',
  revision:27,
  topology:{mode:'remote'},
  limitations:[],
  items:[
    {entity:'tarefas_obra',localId:23,sourceDeviceId:'desktop-1',revision:4,desktopRevision:15,payload:{titulo:'Revisar tubulação',status:'aberta'}},
    {entity:'frentes_obra',localId:11,sourceDeviceId:'desktop-1',revision:0,desktopRevision:5,payload:{nome:'Hidráulica',status:'ativa'}},
    {entity:'cronograma_etapas',localId:44,sourceDeviceId:'desktop-1',revision:2,desktopRevision:9,payload:{status:'atrasada',percentual_realizado:40}}
  ]
});

describe('Gestão Web P0 - transações no navegador',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    document.body.innerHTML='<main id="content"></main>';
    client.get.mockResolvedValue({data:overview()});
    client.post.mockResolvedValue({data:{ok:true}});
  });
  it('exibe contexto da empresa e apenas os registros canônicos recebidos pela ponte',async()=>{
    const root=document.getElementById('content')!;
    await mountP0Management(root,()=>{});
    expect(root.textContent).toContain('Construtora A');
    expect(root.textContent).toContain('Obra Central');
    expect(root.textContent).toContain('Hidráulica');
    expect(root.textContent).toContain('Não foi criado um banco paralelo');
    expect(root.querySelectorAll('[data-p0-edit]')).toHaveLength(1);
    expect(client.get).toHaveBeenCalledWith('/api/web/p0/overview');
  });
  it('envia edição com as duas revisões e sem sobrescrever campos não editados',async()=>{
    const root=document.getElementById('content')!;
    await mountP0Management(root,()=>{});
    root.querySelector<HTMLButtonElement>('[data-p0-tab="tarefas_obra"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-p0-edit="0"]')!.click();
    const title=root.querySelector<HTMLInputElement>('input[name="titulo"]')!;
    title.value='Revisar rede hidráulica';
    root.querySelector<HTMLFormElement>('#p0EditForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledOnce());
    expect(client.post).toHaveBeenCalledWith('/api/web/p0/edit',{
      entity:'tarefas_obra',
      localId:23,
      sourceDeviceId:'desktop-1',
      expectedRevision:4,
      expectedDesktopRevision:15,
      patch:{titulo:'Revisar rede hidráulica'}
    });
  });
  it('permite editar subetapa mantendo vínculo com a etapa do Desktop',async()=>{
    const data=overview();
    data.items.push({entity:'subfrentes_obra',localId:38,sourceDeviceId:'desktop-1',revision:7,desktopRevision:22,payload:{nome:'Prumadas',frente_id:11,escopo:'Torre A',status:'ativa'}} as any);
    client.get.mockResolvedValue({data});
    const root=document.getElementById('content')!;
    await mountP0Management(root,()=>{});
    root.querySelector<HTMLButtonElement>('[data-p0-tab="subfrentes_obra"]')!.click();
    expect(root.textContent).toContain('Prumadas');
    expect(root.textContent).toContain('Etapa: Hidráulica');
    root.querySelector<HTMLButtonElement>('[data-p0-edit="0"]')!.click();
    root.querySelector<HTMLInputElement>('input[name="escopo"]')!.value='Torre B';
    expect(root.querySelector('input[name="frente_id"]')).toBeNull();
    root.querySelector<HTMLFormElement>('#p0EditForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledOnce());
    expect(client.post).toHaveBeenCalledWith('/api/web/p0/edit',{
      entity:'subfrentes_obra',localId:38,sourceDeviceId:'desktop-1',
      expectedRevision:7,expectedDesktopRevision:22,patch:{escopo:'Torre B'}
    });
  });
  it('solicita criação de subetapa no Desktop e não insere registro operacional falso',async()=>{
    const sample=overview();
    client.get.mockResolvedValue({data:{...sample,sources:[{deviceId:'desktop-1',name:'Desktop autorizado'}],commands:[]}});
    client.post.mockResolvedValue({data:{ok:true,command:{id:'id',status:'pending'}}});
    const root=document.getElementById('content')!;
    await mountP0Management(root,()=>{});
    root.querySelector<HTMLButtonElement>('[data-p0-tab="subfrentes_obra"]')!.click();
    root.querySelector<HTMLButtonElement>('#p0Create')!.click();
    expect(root.querySelector<HTMLSelectElement>('[name="frente_id"]')?.querySelectorAll('option')).toHaveLength(1);
    root.querySelector<HTMLInputElement>('#p0CreateForm [name="nome"]')!.value='Prumadas';
    root.querySelector<HTMLFormElement>('#p0CreateForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/web/p0/create',expect.objectContaining({
      entity:'subfrentes_obra',sourceDeviceId:'desktop-1',data:{nome:'Prumadas',frente_id:11}
    })));
    expect(root.textContent).toContain('Aguardando confirmação');
  });
  it('escapa texto recebido da ponte e não transforma conteúdo em HTML executável',async()=>{
    client.get.mockResolvedValue({data:{...overview(),company:{id:'company-a',name:'<img src=x onerror=alert(1)>'}}});
    const root=document.getElementById('content')!;
    await mountP0Management(root,()=>{});
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
  });
});
