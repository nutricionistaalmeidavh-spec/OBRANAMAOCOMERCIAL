// @vitest-environment happy-dom
import {beforeEach,describe,expect,it,vi} from 'vitest';
const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('./cloudflare-client',()=>({api:client}));
import {mountP1Management} from './p1-management';
const overview=()=>({
 company:{id:'a',name:'Empresa A'},project:{id:'work-1',name:'Obra 1'},
 topology:{mode:'remote'},items:[],limitations:[],
 sources:[{deviceId:'desktop-a',name:'Desktop autorizado'}],
 stages:[{entity:'frentes_obra',localId:12,sourceDeviceId:'desktop-a',name:'Hidráulica'}],commands:[]
});
describe('Web P1 criação por comando canônico',()=>{
 beforeEach(()=>{vi.clearAllMocks();document.body.innerHTML='<main id="app"></main>';client.get.mockResolvedValue({data:overview()});client.post.mockResolvedValue({data:{ok:true}})});
 it('cria RDO somente por fila da fonte autorizada e data válida',async()=>{
  const root=document.querySelector<HTMLElement>('#app')!;
  await mountP1Management(root,()=>{});
  root.querySelector<HTMLButtonElement>('#p1Create')!.click();
  root.querySelector<HTMLInputElement>('input[name="data"]')!.value='2026-11-21';
  root.querySelector<HTMLInputElement>('input[name="clima"]')!.value='Sol';
  root.querySelector<HTMLFormElement>('#p1CreateForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/web/p0/create',expect.objectContaining({
    entity:'rdos',sourceDeviceId:'desktop-a',data:{data:'2026-11-21',clima:'Sol'}
  })));
 });
 it('cria checklist associado à etapa da obra na mesma fonte, sem cópia',async()=>{
  const root=document.querySelector<HTMLElement>('#app')!;
  await mountP1Management(root,()=>{});
  root.querySelector<HTMLButtonElement>('[data-p1-tab="checklist_frente_itens"]')!.click();
  root.querySelector<HTMLButtonElement>('#p1Create')!.click();
  root.querySelector<HTMLInputElement>('[name="descricao"]')!.value='Inspecionar shaft';
  root.querySelector<HTMLFormElement>('#p1CreateForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/web/p0/create',expect.objectContaining({
    entity:'checklist_frente_itens',sourceDeviceId:'desktop-a',data:{frente_id:12,descricao:'Inspecionar shaft'}
  })));
 });
 it('não permite criar quando não há fonte operacional autorizada',async()=>{
  client.get.mockResolvedValue({data:{...overview(),sources:[]}});
  const root=document.querySelector<HTMLElement>('#app')!;await mountP1Management(root,()=>{});
  expect(root.querySelector('#p1Create')).toBeNull();
 });
});