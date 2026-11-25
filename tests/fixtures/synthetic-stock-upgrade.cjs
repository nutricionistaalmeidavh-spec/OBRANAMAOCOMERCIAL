// Deterministic synthetic customer; shared between Desktop and LAN upgrade tests.
// No production connection, external service, real identity or copied customer data.
const assert=require('node:assert/strict')
const {stockPage,stockBalance,validateStockMovement,materialReclassificationPreview,confirmMaterialReclassification}=require('../../packages/domain-core/index.cjs')
const insert=(db,table,row)=>Number(db.prepare('INSERT INTO '+table+'('+Object.keys(row).join(',')+') VALUES('+Object.keys(row).map(()=>'?').join(',')+')').run(...Object.values(row)).lastInsertRowid)
const rows=(db,sql,...args)=>db.prepare(sql).all(...args).map(row=>({...row}))
const one=(db,sql,...args)=>({...db.prepare(sql).get(...args)})
const date='2026-11-01'
function seed(db){
 const a=insert(db,'empresas',{razao_social:'Construtora Fictícia A'}),b=insert(db,'empresas',{razao_social:'Construtora Fictícia B'})
 const supplier=insert(db,'fornecedores',{empresa_id:a,nome:'Fornecedor fictício'})
 const work=insert(db,'obras',{empresa_id:a,nome:'Residencial Teste'}),other=insert(db,'obras',{empresa_id:a,nome:'Comercial Teste'}),external=insert(db,'obras',{empresa_id:b,nome:'Obra Externa Teste'})
 const front=insert(db,'frentes_obra',{obra_id:work,nome:'Hidráulica'}),front2=insert(db,'frentes_obra',{obra_id:work,nome:'Acabamento'})
 const order=insert(db,'pedidos_compra',{obra_id:work,fornecedor_id:supplier,descricao:'Compra fictícia',valor_centavos:120000})
 const item=insert(db,'pedido_compra_itens',{pedido_compra_id:order,descricao:'Tubo PVC 25 mm',unidade:'m',quantidade_pedida:100,quantidade_recebida:60,valor_centavos:120000})
 const receipt=insert(db,'recebimentos_materiais',{pedido_compra_id:order,pedido_item_id:item,obra_id:work,frente_id:front,data:date,quantidade_pedida:100,quantidade_recebida:60})
 const movement=(obra_id,descricao,unidade,tipo,quantidade,extra={})=>insert(db,'movimentacoes_estoque',{obra_id,descricao,unidade,tipo,quantidade,data:date,...extra})
 movement(work,'Tubo PVC 25 mm','m','entrada',60,{frente_id:front,pedido_item_id:item})
 movement(work,' tubo pvc 25 mm ','M','entrada',20,{frente_id:front2})
 movement(work,'TB PVC 25mm','m','entrada',15,{frente_id:front})
 movement(work,'Tubo PVC 25 mm','un','entrada',8)
 movement(other,'Tubo PVC 25 mm','m','entrada',30)
 movement(external,'Tubo PVC 25 mm','m','entrada',90)
 const rdo=insert(db,'rdos',{obra_id:work,frente_id:front,data:date,status:'rascunho'})
 const consumption=movement(work,'Tubo PVC 25 mm','m','saida',12,{frente_id:front,request_id:'synthetic-rdo-stock'})
 db.prepare('INSERT INTO rdo_material_linhas(rdo_id,linha_id,servico,frente_id,descricao,unidade,quantidade) VALUES(?,?,?,?,?,?,?)').run(rdo,'tubo','hidraulica',front,'Tubo PVC 25 mm','m',12)
 db.prepare('INSERT INTO rdo_material_revisoes(rdo_id,revisao) VALUES(?,1)').run(rdo)
 db.prepare('INSERT INTO rdo_material_requisicoes(request_id,rdo_id,revisao,payload_hash) VALUES(?,?,?,?)').run('synthetic-rdo',rdo,1,'hash-ficticio')
 db.prepare('INSERT INTO rdo_material_efeitos(rdo_id,request_id,movimentacao_id,descricao,unidade,delta_quantidade) VALUES(?,?,?,?,?,?)').run(rdo,'synthetic-rdo',consumption,'Tubo PVC 25 mm','m',-12)
 const note=insert(db,'notas_recebidas',{empresa_id:a,obra_id:work,fornecedor_id:supplier,numero:'FICT-001',serie:'1',emissao:date,valor_total_centavos:72000,pedido_compra_id:order})
 insert(db,'nota_recebida_itens',{nota_id:note,pedido_item_id:item,frente_id:front,descricao:'Tubo PVC 25 mm',unidade:'m',quantidade:60,valor_unitario_centavos:1200,valor_total_centavos:72000})
 // 10k real movement rows / 250 distinct materials across two works.
 const bulk=db.prepare("INSERT INTO movimentacoes_estoque(obra_id,descricao,unidade,tipo,quantidade,data) VALUES(?,?,'un','entrada',1,?)")
 for(let i=0;i<10000;i++)bulk.run(i%2?other:work,'Material fictício '+(i%250),date)
 return {a,b,supplier,work,other,external,front,front2,order,item,receipt,rdo,note}
}
const tables=['empresas','fornecedores','obras','frentes_obra','pedidos_compra','pedido_compra_itens','recebimentos_materiais','movimentacoes_estoque','rdos','rdo_material_linhas','rdo_material_revisoes','rdo_material_requisicoes','rdo_material_efeitos','notas_recebidas','nota_recebida_itens','contas','pagamentos_conta']
function snapshot(db,prior){
 return Object.fromEntries(tables.map(table=>{
  const columns=prior?prior[table].columns:rows(db,'PRAGMA table_info('+table+')').map(c=>c.name)
  return [table,{columns,rows:rows(db,'SELECT '+columns.map(c=>'"'+c+'"').join(',')+' FROM '+table+' ORDER BY '+columns.map(c=>'"'+c+'"').join(','))}]
 }))
}
function check(db,ids,before){
 const {a,b,work,other,external,front,front2,item,note}=ids
 assert.deepEqual(snapshot(db,before),before,'all existing columns and rows must remain unchanged')
 assert.deepEqual(rows(db,'PRAGMA foreign_key_check'),[])
 assert.equal(one(db,'PRAGMA integrity_check').integrity_check,'ok')
 assert.equal(one(db,'SELECT COUNT(*) n FROM movimentacoes_estoque WHERE material_id IS NULL').n,0)
 const material=one(db,"SELECT material_id id FROM pedido_compra_itens WHERE id=?",item).id
 const balance=(obra_id,descricao,unidade)=>stockBalance(db,{obra_id,descricao,unidade})
 assert.equal(balance(work,'Tubo PVC 25 mm','m'),68)
 assert.equal(balance(work,'TB PVC 25mm','m'),15)
 assert.equal(balance(work,'Tubo PVC 25 mm','un'),8)
 assert.equal(balance(other,'Tubo PVC 25 mm','m'),30)
 assert.equal(balance(external,'Tubo PVC 25 mm','m'),90)
 assert.equal(one(db,'SELECT status_integracao FROM notas_recebidas WHERE id=?',note).status_integracao,'documental')
 assert.equal(one(db,'SELECT COUNT(*) n FROM nota_recebida_xml').n,0)
 assert.equal(one(db,'SELECT COUNT(*) n FROM nota_recebida_recebimentos').n,0)
 assert.equal(one(db,'SELECT COUNT(*) n FROM materiais_estoque WHERE empresa_id=? AND lower(trim(descricao))=? AND lower(trim(unidade))=?',a,'tubo pvc 25 mm','m').n,1)
 const externalId=one(db,"SELECT material_id id FROM movimentacoes_estoque WHERE obra_id=? AND descricao='Tubo PVC 25 mm'",external).id
 assert.notEqual(material,externalId)
 assert.throws(()=>validateStockMovement(db,{obra_id:external,material_id:material,descricao:'Tubo PVC 25 mm',unidade:'m',tipo:'entrada',quantidade:1}))
 assert.doesNotThrow(()=>validateStockMovement(db,{obra_id:work,frente_id:front2,descricao:'Tubo PVC 25 mm',unidade:'m',tipo:'saida',quantidade:65}))
 assert.throws(()=>validateStockMovement(db,{obra_id:work,frente_id:front,descricao:'Tubo PVC 25 mm',unidade:'m',tipo:'saida',quantidade:69}))
 const page=stockPage(db,{obra_id:work,limit:50})
 assert.equal(page.rows.length,50);assert.equal(page.total,128)
 const src=one(db,"SELECT id FROM materiais_estoque WHERE empresa_id=? AND descricao='TB PVC 25mm'",a).id
 const payload={empresa_id:a,origem_id:src,destino_id:material}
 const impact=materialReclassificationPreview(db,payload)
 assert.equal(impact.movimentacoes,1)
 const save=(table,row)=>{const id=insert(db,table,row);return one(db,'SELECT * FROM '+table+' WHERE id=?',id)}
 assert.throws(()=>confirmMaterialReclassification(db,save,{...payload,revision:'wrong',confirmado:true,motivo:'Teste'},'operador fictício'))
 confirmMaterialReclassification(db,save,{...payload,revision:impact.revision,confirmado:true,motivo:'Equivalência confirmada para teste'},'operador fictício')
 assert.equal(balance(work,'Tubo PVC 25 mm','m'),83)
 assert.equal(balance(work,'TB PVC 25mm','m'),83)
 assert.equal(balance(other,'Tubo PVC 25 mm','m'),30)
 assert.equal(balance(external,'Tubo PVC 25 mm','m'),90)
 assert.deepEqual(snapshot(db,before),before,'reclassification must not alter original columns')
 assert.deepEqual(rows(db,'PRAGMA foreign_key_check'),[])
 const catalog=rows(db,'SELECT id,uid FROM materiais_estoque ORDER BY id')
 console.info('[synthetic-upgrade]',JSON.stringify({companies:2,works:3,movements:before.movimentacoes_estoque.rows.length,orders:before.pedidos_compra.rows.length,notes:before.notas_recebidas.rows.length,rdos:before.rdos.rows.length,oldBalance:68,mergedBalance:83,catalog:catalog.length,integrity:'ok'}))
 return catalog
}
module.exports={seed,snapshot,check,rows}
