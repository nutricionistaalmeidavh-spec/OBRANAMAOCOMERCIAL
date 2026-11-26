import { createRequire } from 'node:module'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { describe,it,expect } from 'vitest'
import { parseNfePreview } from '../src/utils/nfe-preview'
const require=createRequire(import.meta.url)
const {DatabaseService}=require('../electron/services/database.cjs')
const {ProcurementService}=require('../electron/services/procurement-service.cjs')
const {createNfeIntegrationService,confirmMaterialAlias}=require('../../../packages/domain-core/index.cjs')
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'nfe-core-'))
 const adapter=new DatabaseService({dataDir:dir,migrationsDir:resolve(import.meta.dirname,'../database/migrations')})
 adapter.open()
 const empresa=adapter.save('empresas',{razao_social:'A',cnpj:'12345678000124'})
 const supplier=adapter.save('fornecedores',{empresa_id:empresa.id,nome:'B',documento:'12345678000123'})
 const work=adapter.save('obras',{empresa_id:empresa.id,nome:'Obra A'})
 const work2=adapter.save('obras',{empresa_id:empresa.id,nome:'Obra B'})
 const category=adapter.db.prepare("SELECT id FROM categorias_financeiras WHERE natureza='despesa' LIMIT 1").get()?.id||adapter.save('categorias_financeiras',{nome:'Material teste',natureza:'despesa'}).id
 const material=adapter.save('materiais_estoque',{empresa_id:empresa.id,descricao:'Tubo',unidade:'m',origem:'confirmado'})
 confirmMaterialAlias(adapter.db,(table:string,data:any)=>adapter.save(table,data),{empresa_id:empresa.id,fornecedor_id:supplier.id,material_id:material.id,codigo:'A',unidade_comercial:'UN',descricao_origem:'Tubo',fator_num:2,fator_den:1},'teste')
 const prefix='35'+'2611'+'12345678000123'+'55'+'001'+'000001234'+'1'+'00001234'
 let sum=0,w=2;for(let i=42;i>=0;i--){sum+=Number(prefix[i])*w;w=w===9?2:w+1}
 const d=11-sum%11,key=prefix+String(d>=10?0:d)
 const xml='<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe'+key+'"><ide><mod>55</mod><tpAmb>1</tpAmb><tpNF>1</tpNF><finNFe>1</finNFe><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-25T08:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000123</CNPJ><xNome>B</xNome></emit><dest><CNPJ>12345678000124</CNPJ></dest><det nItem="1"><prod><cProd>A</cProd><CFOP>5102</CFOP><xProd>Tubo</xProd><uCom>UN</uCom><qCom>1000.0000</qCom><vUnCom>0.1245</vUnCom><vProd>124.50</vProd></prod></det><total><ICMSTot><vProd>124.50</vProd><vNF>124.50</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>'+key+'</chNFe><cStat>100</cStat><nProt>12345</nProt></infProt></protNFe></nfeProc>'
 const payload={xml_base64:Buffer.from(xml).toString('base64'),empresa_id:empresa.id,fornecedor_id:supplier.id,categoria_id:category,data_recebimento:'2026-11-25',destinos:[{nfe_item_numero:'1',obra_id:work.id,quantidade:'600',quantidade_recebida:'400',valor_alocado:'74.70'},{nfe_item_numero:'1',obra_id:work2.id,quantidade:'400',quantidade_recebida:'0',valor_alocado:'49.80'}],parcelas:[{valor:'62.25',vencimento:'2026-12-25'},{valor:'62.25',vencimento:'2027-01-25'}]}
 const service=createNfeIntegrationService(adapter.db,{parseXml:parseNfePreview,saveEntity:(table:string,data:any)=>adapter.save(table,data)})
 return {adapter,payload,service,material,close(){adapter.close();rmSync(dir,{recursive:true,force:true})}}
}
describe('núcleo transacional NF-e (não exposto a IPC/HTTP)',()=>{
 it('preserva centavos, rateio, parcelas, XML e recebimento parcial sem duplicar no replay',()=>{const f=fixture();try{
  const saved=f.service.commit(f.payload),db=f.adapter.db
  expect(f.service.commit(f.payload)).toMatchObject({nota_id:saved.nota_id,replayed:true})
  expect(()=>f.service.commit({...f.payload,destinos:f.payload.destinos.map((d,i)=>i===0?{...d,quantidade_recebida:'500'}:d)})).toThrow(/Chave fiscal/)
  expect(db.prepare('SELECT SUM(valor_centavos) total FROM contas').get().total).toBe(12450)
  expect(db.prepare('SELECT SUM(valor_total_centavos) total FROM nota_recebida_itens').get().total).toBe(12450)
  expect(db.prepare('SELECT SUM(quantidade) total FROM movimentacoes_estoque').get().total).toBe(800)
  expect(db.prepare('SELECT material_id,unidade,quantidade FROM movimentacoes_estoque').get()).toMatchObject({material_id:f.material.id,unidade:'m',quantidade:800})
  expect(db.prepare('SELECT descricao,unidade,quantidade,material_id FROM nota_recebida_itens ORDER BY id').get()).toMatchObject({descricao:'Tubo',unidade:'UN',quantidade:600,material_id:f.material.id})
  expect(db.prepare('SELECT COUNT(*) total FROM nota_recebida_xml').get().total).toBe(1)
  expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
 }finally{f.close()}})
 it('recebe saldo posteriormente, rejeita excesso e estorna preservando trilha',()=>{const f=fixture();try{
  const saved=f.service.commit(f.payload),db=f.adapter.db
  const item=db.prepare('SELECT id FROM nota_recebida_itens WHERE nota_id=? ORDER BY id').get(saved.nota_id)
  const receive={empresa_id:f.payload.empresa_id,nota_id:saved.nota_id,nota_item_id:item.id,quantidade:'200',data:'2026-11-26',request_id:'rec-1'}
  const received=f.service.receive(receive)
  expect(f.service.receive(receive)).toMatchObject({recebimento_id:received.recebimento_id,replayed:true})
  expect(()=>f.service.receive({...receive,request_id:'rec-2',quantidade:'1'})).toThrow(/supera/)
  const reverse={empresa_id:f.payload.empresa_id,nota_id:saved.nota_id,request_id:'rev-1',motivo:'Devolução integral',operador:'teste',data:'2026-11-27'}
  const reversed=f.service.reverse(reverse)
  expect(f.service.reverse(reverse)).toMatchObject({estorno_id:reversed.estorno_id,replayed:true})
  expect(db.prepare("SELECT SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END) total FROM movimentacoes_estoque").get().total).toBe(0)
  expect(db.prepare("SELECT COUNT(*) n FROM contas WHERE status='cancelado'").get().n).toBe(2)
  expect(db.prepare('SELECT COUNT(*) n FROM nota_recebida_xml').get().n).toBe(1)
  expect(db.prepare('SELECT COUNT(*) n FROM nota_recebida_estorno_movimentos').get().n).toBe(2)
 }finally{f.close()}})
 it('não estorna uma nota com baixa financeira',()=>{const f=fixture();try{
  const saved=f.service.commit(f.payload)
  f.adapter.save('pagamentos_conta',{conta_id:saved.contas[0],valor_centavos:100,data:'2026-11-25'})
  expect(()=>f.service.reverse({empresa_id:f.payload.empresa_id,nota_id:saved.nota_id,request_id:'rev-pago',motivo:'Teste',operador:'teste',data:'2026-11-27'})).toThrow(/contas preexistentes, pagas/)
  expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM nota_recebida_estornos').get().n).toBe(0)
 }finally{f.close()}})
 it('rejeita rateio incompleto e reverte uma falha tardia de recebimento',()=>{const f=fixture();try{
  expect(()=>f.service.commit({...f.payload,destinos:f.payload.destinos.slice(0,1)})).toThrow()
  expect(()=>f.service.commit({...f.payload,data_recebimento:''})).toThrow()
  for(const table of ['notas_recebidas','nota_recebida_itens','nota_recebida_xml','contas','movimentacoes_estoque'])expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM '+table).get().n).toBe(0)
 }finally{f.close()}})
 it('recusa destinatário diferente e ambiente de homologação',()=>{const f=fixture();try{
  for(const [old,next] of [['12345678000124','12345678000125'],['<tpAmb>1','<tpAmb>2']]){
   const xml=Buffer.from(f.payload.xml_base64,'base64').toString().replace(old,next)
   expect(()=>f.service.commit({...f.payload,xml_base64:Buffer.from(xml).toString('base64')})).toThrow()
  }
 }finally{f.close()}})
})

it('não integra CFOP de devolução ou material sem equivalência confirmada',()=>{const f=fixture();try{
 for(const [old,next] of [['<CFOP>5102','<CFOP>5202'],['<cProd>A','<cProd>SEM-VINCULO']]){
  const xml=Buffer.from(f.payload.xml_base64,'base64').toString().replace(old,next)
  expect(()=>f.service.commit({...f.payload,xml_base64:Buffer.from(xml).toString('base64')})).toThrow(/compra|equivalência/i)
 }
 expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n).toBe(0)
 expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM contas').get().n).toBe(0)
}finally{f.close()}})

it('revalida XML original no backend, identifica fornecedor e rejeita destinatário divergente',()=>{
 const f=fixture();try{
  const service=new ProcurementService({db:f.adapter})
  const source={obra_id:f.payload.destinos[0].obra_id,xml_base64:f.payload.xml_base64}
  const result=service.nfeRecognize(source)
  expect(result).toMatchObject({fornecedor_id:f.payload.fornecedor_id,elegivel_compra:true,registro_existente:null,itens:[{status:'confirmado',material_id:f.material.id}]})
  expect(()=>service.nfeRecognize({...source,xml_base64:Buffer.from('<!DOCTYPE NFe><NFe/>').toString('base64')})).toThrow()
  expect(()=>service.nfeRecognize({...source,xml_base64:Buffer.from(Buffer.from(source.xml_base64,'base64').toString().replace('12345678000124','12345678000125')).toString('base64')})).toThrow(/Destinatário/)
  f.service.commit(f.payload)
  expect(service.nfeRecognize(source)).toMatchObject({elegivel_compra:false,registro_existente:{status_integracao:'integrada'}})
 }finally{f.close()}
})

it('confirma importação via serviço Desktop e apropria DRE multiobra sem duplicar a obrigação',()=>{
 const f=fixture();try{
  const s=new ProcurementService({db:f.adapter})
  const result=s.nfeCommit(f.payload)
  expect(s.nfeCommit(f.payload)).toMatchObject({nota_id:result.nota_id,replayed:true})
  const dre=(work?:number)=>f.adapter.dre({competencia:'2026-11',empresa_id:f.payload.empresa_id,obra_id:work}).reduce((sum:number,r:any)=>sum+r.valor,0)
  expect(dre()).toBe(12450)
  expect(dre(f.payload.destinos[0].obra_id)).toBe(7470)
  expect(dre(f.payload.destinos[1].obra_id)).toBe(4980)
  expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM contas').get().n).toBe(2)
  expect(s.nfeDetails({empresa_id:f.payload.empresa_id,nota_id:result.nota_id}).itens.length).toBe(2)
 }finally{f.close()}
})

it('recebe pedido posteriormente e estorna quantidades sem apagar histórico',()=>{
 const f=fixture();try{
  const db=f.adapter.db,work=f.payload.destinos[0].obra_id
  const order=f.adapter.save('pedidos_compra',{obra_id:work,fornecedor_id:f.payload.fornecedor_id,descricao:'Pedido fictício',valor_centavos:12450})
  const item=f.adapter.save('pedido_compra_itens',{pedido_compra_id:order.id,material_id:f.material.id,descricao:'Tubo',unidade:'m',quantidade_pedida:2000,valor_centavos:12450})
  const result=f.service.commit({...f.payload,destinos:[{...f.payload.destinos[0],pedido_item_id:item.id,quantidade:'1000',quantidade_recebida:'400',valor_alocado:'124.50'}]})
  const dest=db.prepare('SELECT id FROM nota_recebida_itens WHERE nota_id=?').get(result.nota_id)
  const follow={empresa_id:f.payload.empresa_id,nota_id:result.nota_id,nota_item_id:dest.id,quantidade:'600',data:'2026-11-26',request_id:'pedido-follow'}
  f.service.receive(follow)
  expect(f.service.receive(follow).replayed).toBe(true)
  expect(f.adapter.get('pedido_compra_itens',item.id).quantidade_recebida).toBe(2000)
  expect(f.adapter.get('pedidos_compra',order.id).status).toBe('recebido')
  f.service.reverse({empresa_id:f.payload.empresa_id,nota_id:result.nota_id,data:'2026-11-27',request_id:'pedido-reverse',motivo:'Erro de importação',operador:'teste'})
  expect(f.adapter.get('pedido_compra_itens',item.id).quantidade_recebida).toBe(0)
  expect(f.adapter.get('pedidos_compra',order.id).status).toBe('emitido')
  expect(db.prepare("SELECT SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END) n FROM movimentacoes_estoque").get().n).toBe(0)
  expect(db.prepare('SELECT COUNT(*) n FROM recebimentos_materiais').get().n).toBe(2)
 }finally{f.close()}
})
it('protege valores e rateio fiscal contra edição genérica e conserva pagamentos no DRE',()=>{
 const f=fixture();try{
  const result=f.service.commit(f.payload)
  expect(()=>f.adapter.save('contas',{id:result.contas[0],valor_centavos:1})).toThrow(/NF-e/)
  expect(()=>f.adapter.remove('contas',result.contas[0])).toThrow(/NF-e/)
  f.adapter.accountPayment(result.contas[0],{valor_centavos:4000,data:'2026-11-26'})
  expect(()=>f.adapter.accountPayment(result.contas[0],{valor_centavos:3000,data:'2026-11-26'})).toThrow(/excede/)
  const total=(work?:number)=>f.adapter.dre({competencia:'2026-11',empresa_id:f.payload.empresa_id,obra_id:work}).reduce((sum:number,r:any)=>sum+r.valor_realizado,0)
  expect(total()).toBe(4000)
  expect(total(f.payload.destinos[0].obra_id)+total(f.payload.destinos[1].obra_id)).toBe(4000)
 }finally{f.close()}
})

it('integra nota manual sem XML ou chave fictícia, rateia, recebe depois e estorna pelo mesmo núcleo',()=>{
 const f=fixture();try{
  const {xml_base64,...base}=f.payload
  const payload={...base,manual:{numero:'MAN-1',serie:'',emissao:'2026-11-25',itens:[{numero:'1',descricao:'Tubo informado',unidade:'m',quantidade:'1000',valor_unitario:'0.1245',valor_produto:'124.50',material_id:f.material.id}]}}
  const result=f.service.commit(payload),db=f.adapter.db
  expect(f.service.commit(payload)).toMatchObject({nota_id:result.nota_id,replayed:true})
  expect(db.prepare('SELECT chave_acesso,status_integracao FROM notas_recebidas WHERE id=?').get(result.nota_id)).toMatchObject({chave_acesso:null,status_integracao:'integrada'})
  expect(db.prepare('SELECT COUNT(*) n FROM nota_recebida_xml').get().n).toBe(0)
  expect(db.prepare('SELECT SUM(valor_centavos) n FROM nota_recebida_rateios').get().n).toBe(12450)
  expect(db.prepare('SELECT SUM(quantidade) n FROM movimentacoes_estoque').get().n).toBe(400)
  const item=db.prepare('SELECT id FROM nota_recebida_itens ORDER BY id').get()
  f.service.receive({empresa_id:base.empresa_id,nota_id:result.nota_id,nota_item_id:item.id,quantidade:'200',data:'2026-11-26',request_id:'manual-rec'})
  f.service.reverse({empresa_id:base.empresa_id,nota_id:result.nota_id,data:'2026-11-27',request_id:'manual-rev',motivo:'Teste',operador:'QA'})
  expect(db.prepare("SELECT SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END) n FROM movimentacoes_estoque").get().n).toBe(0)
  expect(db.prepare("SELECT COUNT(*) n FROM contas WHERE status='cancelado'").get().n).toBe(2)
  expect(()=>f.service.commit(payload)).toThrow()
 }finally{f.close()}
})
it('nota manual não aceita material externo, total inventado, mistura com XML ou recebimento de serviço',()=>{
 const f=fixture();try{
  const {xml_base64,...base}=f.payload
  const manual={numero:'MAN-2',serie:'',emissao:'2026-11-25',itens:[{numero:'1',descricao:'Tubo',unidade:'m',quantidade:'1000',valor_unitario:'0.1245',valor_produto:'124.50',material_id:f.material.id}]}
  for(const bad of [{...base,manual,xml_base64},{...base,manual:{...manual,itens:[{...manual.itens[0],material_id:99999}]}},{...base,manual:{...manual,itens:[{...manual.itens[0],valor_produto:'124.51'}]}},{...base,manual:{...manual,itens:[{...manual.itens[0],material_id:null,servico:true}]}}])expect(()=>f.service.commit(bad)).toThrow()
  expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM notas_recebidas').get().n).toBe(0)
 }finally{f.close()}
})
