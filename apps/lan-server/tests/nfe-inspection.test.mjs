import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { LanRepository } from '../src/repository.mjs'
import { MigrationService,MODULE_TABLES } from '../src/migration-service.mjs'
import { FinanceService } from '../src/finance-service.mjs'
import { ProcurementService } from '../src/procurement-service.mjs'
const migrationsDir=path.resolve(import.meta.dirname,'../migrations')
function key(){const prefix='3526111234567800012355001000001234100001234';let sum=0,w=2;for(let i=42;i>=0;i--){sum+=Number(prefix[i])*w;w=w===9?2:w+1}const n=11-sum%11;return prefix+String(n>=10?0:n)}
function xml(cfop='5102',recipient='12345678000124',description='TB PVC ESG DN100 6MT'){
 const access=key()
 return '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe'+access+'"><ide><mod>55</mod><tpAmb>1</tpAmb><tpNF>1</tpNF><finNFe>1</finNFe><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-25T08:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000123</CNPJ><xNome>Fornecedor fictício</xNome></emit><dest><CNPJ>'+recipient+'</CNPJ></dest><det nItem="1"><prod><cProd>TB-100</cProd><xProd>'+description+'</xProd><CFOP>'+cfop+'</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>15.00</vUnCom><vProd>30.00</vProd></prod></det><total><ICMSTot><vProd>30.00</vProd><vNF>30.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>'+access+'</chNFe><cStat>100</cStat><nProt>12345</nProt></infProt></protNFe></nfeProc>'
}
test('LAN lê XML original, sugere material, aprende equivalência e não lança estoque nem contas',()=>{
 const repository=new LanRepository({filename:':memory:'})
 try{
  repository.applyMigrations(migrationsDir)
  const company=repository.save('empresas',{razao_social:'Construtora fictícia',cnpj:'12345678000124'})
  const supplier=repository.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor fictício',documento:'12.345.678/0001-23'})
  const work=repository.save('obras',{empresa_id:company.id,nome:'Obra fictícia'})
  const service=new ProcurementService({repository})
  const material=service.catalogSave({empresa_id:company.id,descricao:'Tubo PVC esgoto DN100 6 m',unidade:'un',atributos:{}})
  const payload={obra_id:work.id,xml_base64:Buffer.from(xml()).toString('base64')}
  const first=service.nfeRecognize(payload)
  assert.equal(first.fornecedor_id,supplier.id);assert.equal(first.elegivel_compra,true);assert.equal(first.itens[0].status,'revisar')
  assert.equal(first.itens[0].candidatos[0].material_id,material.id)
  service.catalogConfirm({empresa_id:company.id,fornecedor_id:supplier.id,material_id:material.id,codigo:'TB-100',unidade_comercial:'UN',descricao_origem:'TB PVC ESG DN100 6MT',fator_num:1,fator_den:1},'operador-teste')
  assert.equal(service.nfeRecognize(payload).itens[0].status,'confirmado')
  assert.equal(service.nfeRecognize({...payload,xml_base64:Buffer.from(xml('5202')).toString('base64')}).elegivel_compra,false)
  assert.equal(service.nfeRecognize({...payload,xml_base64:Buffer.from(xml('5102','12345678000124','TB PVC ESG DN75 6MT')).toString('base64')}).itens[0].status,'conflito')
  assert.throws(()=>service.nfeRecognize({...payload,xml_base64:Buffer.from(xml('5102','12345678000125')).toString('base64')}),/Destinatário/)
  for(const table of ['contas','movimentacoes_estoque','notas_recebidas'])assert.equal(repository.connection().prepare('SELECT COUNT(*) n FROM '+table).get().n,0)
  assert.deepEqual(repository.connection().prepare('PRAGMA foreign_key_check').all(),[])
 }finally{repository.close()}
})

test('LAN integra e migra nota, bytes originais, rateios e vínculos para IDs distintos',()=>{
 const source=new LanRepository({filename:':memory:'}),target=new LanRepository({filename:':memory:'})
 try{
  source.applyMigrations(migrationsDir);target.applyMigrations(migrationsDir)
  const company=source.save('empresas',{razao_social:'Fictícia',cnpj:'12345678000124'})
  const work=source.save('obras',{empresa_id:company.id,nome:'Obra A'}),work2=source.save('obras',{empresa_id:company.id,nome:'Obra B'})
  const supplier=source.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor',documento:'12345678000123'})
  const category=source.connection().prepare("SELECT id FROM categorias_financeiras WHERE natureza='despesa' AND ativa=1 LIMIT 1").get()?.id||source.save('categorias_financeiras',{nome:'Materiais fictícios',natureza:'despesa',ativa:1}).id
  const service=new ProcurementService({repository:source})
  const material=service.catalogSave({empresa_id:company.id,descricao:'Tubo PVC esgoto DN100 6 m',unidade:'un',atributos:{}})
  service.catalogConfirm({empresa_id:company.id,fornecedor_id:supplier.id,material_id:material.id,codigo:'TB-100',unidade_comercial:'UN',descricao_origem:'TB PVC ESG DN100 6MT',fator_num:1,fator_den:1},'teste')
  const payload={xml_base64:Buffer.from(xml()).toString('base64'),empresa_id:company.id,fornecedor_id:supplier.id,categoria_id:category,data_recebimento:'2026-11-25',destinos:[{nfe_item_numero:'1',obra_id:work.id,quantidade:'1',quantidade_recebida:'1',valor_alocado:'15.00'},{nfe_item_numero:'1',obra_id:work2.id,quantidade:'1',quantidade_recebida:'0',valor_alocado:'15.00'}],parcelas:[{valor:'30.00',vencimento:'2026-12-25'}]}
  const note=service.nfeCommit(payload)
  assert.equal(service.nfeCommit(payload).replayed,true)
  target.save('empresas',{razao_social:'Outra empresa fictícia'})
  const migration=new MigrationService({repository:target})
  const mapping={}
  for(const module of ['core','operation','planning','finance']){
   const records=Object.fromEntries(MODULE_TABLES[module].map(table=>[table,source.connection().prepare('SELECT * FROM '+table+' ORDER BY id').all()]))
   const id='nfe-migrate-'+module
   migration.start({migrationId:id,module,sourceFingerprint:'nfe-ficticia',expectedCounts:Object.fromEntries(Object.entries(records).map(([table,rows])=>[table,rows.length]))})
   for(const [table,rows] of Object.entries(records))for(const row of rows){
    let data={...row}
    if(table==='nota_recebida_xml'){data.__xml_base64=Buffer.from(data.xml_original).toString('base64');delete data.xml_original}
    const mapped=migration.importRecord(id,{sourceTable:table,sourceId:row.id,data})
    mapping[table+':'+row.id]=mapped.targetId
   }
   migration.validate(id);migration.commit(id)
  }
  const mappedCompany=mapping['empresas:'+company.id],mappedWork=mapping['obras:'+work.id],mappedNote=mapping['notas_recebidas:'+note.nota_id]
  assert.notEqual(mappedCompany,company.id)
  const restored=target.connection().prepare('SELECT * FROM nota_recebida_xml WHERE nota_id=?').get(mappedNote)
  assert.equal(Buffer.from(restored.xml_original).toString('base64'),payload.xml_base64)
  assert.equal(target.connection().prepare('SELECT SUM(valor_centavos) n FROM nota_recebida_rateios').get().n,3000)
  assert.equal(target.connection().prepare('SELECT COUNT(*) n FROM contas').get().n,1)
  const report=new FinanceService({repository:target})
  assert.equal(report.dre({empresa_id:mappedCompany,obra_id:mappedWork,competencia:'2026-11'}).reduce((s,r)=>s+r.valor,0),1500)
  assert.deepEqual(target.connection().prepare('PRAGMA foreign_key_check').all(),[])
 }finally{source.close();target.close()}
})
