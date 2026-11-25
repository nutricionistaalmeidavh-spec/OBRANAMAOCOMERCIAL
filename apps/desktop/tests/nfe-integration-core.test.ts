import { createRequire } from 'node:module'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { describe,it,expect } from 'vitest'
import { parseNfePreview } from '../src/utils/nfe-preview'
const require=createRequire(import.meta.url)
const {DatabaseService}=require('../electron/services/database.cjs')
const {createNfeIntegrationService}=require('../../../packages/domain-core/index.cjs')
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'nfe-core-'))
 const adapter=new DatabaseService({dataDir:dir,migrationsDir:resolve(import.meta.dirname,'../database/migrations')})
 adapter.open()
 const empresa=adapter.save('empresas',{razao_social:'A',cnpj:'12345678000124'})
 const supplier=adapter.save('fornecedores',{empresa_id:empresa.id,nome:'B',documento:'12345678000123'})
 const work=adapter.save('obras',{empresa_id:empresa.id,nome:'Obra A'})
 const work2=adapter.save('obras',{empresa_id:empresa.id,nome:'Obra B'})
 const category=adapter.db.prepare("SELECT id FROM categorias_financeiras WHERE natureza='despesa' LIMIT 1").get()?.id||adapter.save('categorias_financeiras',{nome:'Material teste',natureza:'despesa'}).id
 const prefix='35'+'2611'+'12345678000123'+'55'+'001'+'000001234'+'1'+'00001234'
 let sum=0,w=2;for(let i=42;i>=0;i--){sum+=Number(prefix[i])*w;w=w===9?2:w+1}
 const d=11-sum%11,key=prefix+String(d>=10?0:d)
 const xml='<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe'+key+'"><ide><mod>55</mod><tpAmb>1</tpAmb><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-25T08:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000123</CNPJ><xNome>B</xNome></emit><dest><CNPJ>12345678000124</CNPJ></dest><det nItem="1"><prod><cProd>A</cProd><xProd>Tubo</xProd><uCom>UN</uCom><qCom>1000.0000</qCom><vUnCom>0.1245</vUnCom><vProd>124.50</vProd></prod></det><total><ICMSTot><vProd>124.50</vProd><vNF>124.50</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>'+key+'</chNFe><cStat>100</cStat><nProt>12345</nProt></infProt></protNFe></nfeProc>'
 const payload={xml_base64:Buffer.from(xml).toString('base64'),empresa_id:empresa.id,fornecedor_id:supplier.id,categoria_id:category,data_recebimento:'2026-11-25',destinos:[{nfe_item_numero:'1',obra_id:work.id,quantidade:'600',quantidade_recebida:'400',valor_alocado:'74.70'},{nfe_item_numero:'1',obra_id:work2.id,quantidade:'400',quantidade_recebida:'0',valor_alocado:'49.80'}],parcelas:[{valor:'62.25',vencimento:'2026-12-25'},{valor:'62.25',vencimento:'2027-01-25'}]}
 const service=createNfeIntegrationService(adapter.db,{parseXml:parseNfePreview,saveEntity:(table:string,data:any)=>adapter.save(table,data)})
 return {adapter,payload,service,close(){adapter.close();rmSync(dir,{recursive:true,force:true})}}
}
describe('núcleo transacional NF-e (não exposto a IPC/HTTP)',()=>{
 it('preserva centavos, rateio, parcelas, XML e recebimento parcial sem duplicar no replay',()=>{const f=fixture();try{
  const saved=f.service.commit(f.payload),db=f.adapter.db
  expect(f.service.commit(f.payload)).toMatchObject({nota_id:saved.nota_id,replayed:true})
  expect(()=>f.service.commit({...f.payload,destinos:f.payload.destinos.map((d,i)=>i===0?{...d,quantidade_recebida:'500'}:d)})).toThrow(/Chave fiscal/)
  expect(db.prepare('SELECT SUM(valor_centavos) total FROM contas').get().total).toBe(12450)
  expect(db.prepare('SELECT SUM(valor_total_centavos) total FROM nota_recebida_itens').get().total).toBe(12450)
  expect(db.prepare('SELECT SUM(quantidade) total FROM movimentacoes_estoque').get().total).toBe(400)
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
