import {it,expect} from 'vitest';
import {p1Rows} from './web-p1-policy';
it('projects only safe fields and child links needed to receive purchase items',()=>{
 const rows=p1Rows({purchaseItems:[{entity:'pedido_compra_itens',localId:19,sourceDeviceId:'pc-1',payload:{
   descricao:'Tubo PVC',pedido_compra_id:7,quantidade_pedida:5,quantidade_recebida:1,unidade:'m',
   arquivo_secreto:'/home/x',deleted:false
 }}]});
 expect(rows).toHaveLength(1);
 expect(rows[0]).toMatchObject({entity:'pedido_compra_itens',localId:19,
   payload:{descricao:'Tubo PVC',pedido_compra_id:7,quantidade_pedida:5,quantidade_recebida:1}});
 expect(rows[0].payload).not.toHaveProperty('arquivo_secreto');
});
