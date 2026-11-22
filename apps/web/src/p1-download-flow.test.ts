// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest';
const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('./cloudflare-client',()=>({api:client}));
import {mountP1Management} from './p1-management';
beforeEach(()=>{vi.clearAllMocks();document.body.innerHTML='<main id="app"></main>';client.get.mockResolvedValue({data:{
 company:{id:'a',name:'Empresa'},project:{id:'p',name:'Obra'},topology:{mode:'remote'},
 items:[{entity:'documentos',localId:33,sourceDeviceId:'pc-1',revision:1,desktopRevision:5,payload:{titulo:'Projeto executivo',categoria:'projeto'}}],
 sources:[{deviceId:'pc-1',name:'Origem'}],stages:[],commands:[],
 capabilities:{finance:true,documents:true,documentTransport:true},limitations:[]
}})});
it('requests document bytes through canonical source; browser path is never trusted',async()=>{
 client.post.mockResolvedValueOnce({data:{request:{id:'request-id',status:'pending'}}});
 const root=document.querySelector<HTMLElement>('#app')!;await mountP1Management(root,()=>{});
 root.querySelector<HTMLButtonElement>('[data-p1-tab="documentos"]')!.click();
 root.querySelector<HTMLButtonElement>('[data-p1-download="0"]')!.click();
 await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/web/p1/documents/download/request',{sourceDeviceId:'pc-1',localId:33}));
 await vi.waitFor(()=>expect(root.textContent).toContain('sincronização'));
});