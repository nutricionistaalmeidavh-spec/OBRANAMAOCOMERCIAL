// @vitest-environment happy-dom
import {beforeEach,describe,expect,it,vi} from 'vitest';
const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('./cloudflare-client',()=>({api:client}));
import {mountP1Management} from './p1-management';
const data=()=>({
 company:{id:'tenant-1',name:'Empresa'},project:{id:'obra-1',name:'Obra'},topology:{mode:'remote'},
 sources:[{deviceId:'pc-1',name:'Servidor autorizado'}],stages:[],commands:[],limitations:[],
 capabilities:{finance:true},
 items:[
 {entity:'itens_orcamentarios',localId:7,sourceDeviceId:'pc-1',revision:0,desktopRevision:1,payload:{descricao:'PVC 100mm',unidade:'m',quantidade:10,valor_unitario_centavos:1000}},
 {entity:'pedido_compra_itens',localId:13,sourceDeviceId:'pc-1',revision:0,desktopRevision:1,payload:{descricao:'Tubo',pedido_compra_id:11,quantidade_pedida:5,quantidade_recebida:1,unidade:'m'}},
 {entity:'contratos_obra',localId:23,sourceDeviceId:'pc-1',revision:0,desktopRevision:1,payload:{descricao:'Contrato A'}}
 ]});
describe('P1 transactional Web forms',()=>{
 beforeEach(()=>{vi.clearAllMocks();document.body.innerHTML='<main id="app"></main>';client.get.mockResolvedValue({data:data()});client.post.mockResolvedValue({data:{ok:true}})});
 it('creates a measurement using the canonical budget selector and derived typed item',async()=>{
  const root=document.querySelector<HTMLElement>('#app')!;await mountP1Management(root,()=>{});
  root.querySelector<HTMLButtonElement>('[data-p1-tab="medicoes"]')!.click();
  root.querySelector<HTMLButtonElement>('#p1Create')!.click();
  root.querySelector<HTMLInputElement>('[name="numero"]')!.value='M03';
  root.querySelector<HTMLInputElement>('[name="competencia"]')!.value='2026-11';
  root.querySelector<HTMLInputElement>('[name="data"]')!.value='2026-11-22';
  root.querySelector<HTMLInputElement>('[name="quantidade_periodo"]')!.value='2.5';
  root.querySelector<HTMLInputElement>('[name="valor_periodo_reais"]')!.value='25.00';
  root.querySelector<HTMLFormElement>('#p1CreateForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/web/p1/command',expect.objectContaining({
    entity:'medicoes',sourceDeviceId:'pc-1',data:expect.objectContaining({numero:'M03',itens:[{item_orcamentario_id:7,quantidade_periodo:2.5,valor_periodo_centavos:2500}]})
  })));
 });
 it('registers a partial receipt using an actual order item without guessing IDs',async()=>{
  const root=document.querySelector<HTMLElement>('#app')!;await mountP1Management(root,()=>{});
  root.querySelector<HTMLButtonElement>('[data-p1-tab="recebimentos_materiais"]')!.click();
  root.querySelector<HTMLButtonElement>('#p1Create')!.click();
  expect(root.querySelector<HTMLSelectElement>('[name="pedido_item_id"]')!.value).toBe('13');
  root.querySelector<HTMLInputElement>('[name="quantidade_recebida"]')!.value='2';
  root.querySelector<HTMLInputElement>('[name="data"]')!.value='2026-11-22';
  root.querySelector<HTMLFormElement>('#p1CreateForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/web/p1/command',expect.objectContaining({
    entity:'recebimentos_materiais',data:{pedido_item_id:13,quantidade_recebida:2,data:'2026-11-22'}
  })));
 });
 it('does not expose financial mutations without finance entitlement',async()=>{
  client.get.mockResolvedValue({data:{...data(),capabilities:{finance:false}}});
  const root=document.querySelector<HTMLElement>('#app')!;await mountP1Management(root,()=>{});
  root.querySelector<HTMLButtonElement>('[data-p1-tab="contratos_obra"]')!.click();
  expect(root.querySelector('#p1Create')).toBeNull();
 });
});
