import { describe,it,expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const require=createRequire(import.meta.url)
const DB=require('better-sqlite3')
const {stockPage,stockBalance,validateStockMovement,materialCatalog,materialAliases,saveMaterialCatalog,confirmMaterialAlias,materialReclassificationPreview,confirmMaterialReclassification}=require('../../../packages/domain-core/index.cjs')
function fixture(){
 const db=new DB(':memory:')
 db.pragma('foreign_keys=ON')
 db.exec("CREATE TABLE empresas(id INTEGER PRIMARY KEY,nome_fantasia TEXT,razao_social TEXT,deleted_at TEXT);CREATE TABLE fornecedores(id INTEGER PRIMARY KEY,empresa_id INTEGER,deleted_at TEXT,nome TEXT,documento TEXT);CREATE TABLE obras(id INTEGER PRIMARY KEY,empresa_id INTEGER,nome TEXT,deleted_at TEXT);CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,nome TEXT,deleted_at TEXT);CREATE TABLE pedidos_compra(id INTEGER PRIMARY KEY,obra_id INTEGER);CREATE TABLE pedido_compra_itens(id INTEGER PRIMARY KEY,pedido_compra_id INTEGER,descricao TEXT,unidade TEXT,quantidade_pedida REAL,valor_centavos INTEGER);CREATE TABLE movimentacoes_estoque(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,pedido_item_id INTEGER,descricao TEXT,unidade TEXT,tipo TEXT,quantidade REAL,data TEXT);INSERT INTO empresas VALUES(1,NULL,'A',NULL),(2,NULL,'B',NULL);INSERT INTO fornecedores VALUES(1,1,NULL,'Fornecedor A','12345678000123'),(2,2,NULL,'Fornecedor B','12345678000124');INSERT INTO obras VALUES(1,1,'A1',NULL),(2,1,'A2',NULL),(3,2,'B1',NULL);INSERT INTO movimentacoes_estoque VALUES(1,1,NULL,NULL,'Tubo PVC','UN','entrada',10,'2026-11-01'),(2,2,NULL,NULL,' tubo pvc ','un','entrada',5,'2026-11-02'),(3,3,NULL,NULL,'Tubo PVC','UN','entrada',8,'2026-11-01'),(4,1,NULL,NULL,'Tubo PVC','m','entrada',2,'2026-11-01');")
 for(const name of ['029_material_catalog.sql','030_stock_revision.sql','031_material_reclassification.sql'])db.exec(readFileSync(resolve(import.meta.dirname,'../database/migrations',name),'utf8'))
 return db
}
describe('identidade persistente por empresa',()=>{
 it('migra por igualdade exata sem mudar descrições, quantidades ou misturar empresas/unidades',()=>{const db=fixture();try{const rows=db.prepare('SELECT * FROM movimentacoes_estoque ORDER BY id').all();expect(rows[0].material_id).toBe(rows[1].material_id);expect(rows[0].material_id).not.toBe(rows[2].material_id);expect(rows[0].material_id).not.toBe(rows[3].material_id);expect(rows[1].descricao).toBe(' tubo pvc ');expect(rows[1].quantidade).toBe(5);expect(stockPage(db,{obra_id:1}).rows).toHaveLength(2);expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])}finally{db.close()}})
 it('mantém descrição alternativa quando há associação explícita e rejeita material de outra empresa',()=>{const db=fixture();try{const id=db.prepare('SELECT material_id FROM movimentacoes_estoque WHERE id=1').get().material_id;db.prepare("INSERT INTO movimentacoes_estoque(obra_id,descricao,unidade,tipo,quantidade,data,material_id) VALUES(1,'TB PVC','un','entrada',3,'2026-11-03',?)").run(id);expect(stockBalance(db,{obra_id:1,material_id:id,unidade:'un'})).toBe(13);expect(stockPage(db,{obra_id:1}).rows.find((r:any)=>r.material_id===id).saldo).toBe(13);expect(()=>validateStockMovement(db,{obra_id:3,material_id:id,descricao:'TB PVC',unidade:'un',tipo:'entrada',quantidade:1})).toThrow();expect(()=>db.prepare("INSERT INTO movimentacoes_estoque(obra_id,descricao,unidade,tipo,quantidade,data,material_id) VALUES(3,'TB PVC','un','entrada',1,'2026-11-03',?)").run(id)).toThrow()}finally{db.close()}})
 it('impede equivalência com fornecedor de outra empresa ou fator inválido',()=>{const db=fixture();try{const id=db.prepare('SELECT material_id FROM movimentacoes_estoque WHERE id=1').get().material_id;const ins=db.prepare("INSERT INTO material_fornecedor_equivalencias(empresa_id,fornecedor_id,material_id,codigo,unidade_comercial,descricao_origem,fator_num,fator_den,confirmado_por) VALUES(1,?,?,?,'CX','Tubo',?,1,'operador')");ins.run(1,id,'A',10);expect(()=>ins.run(2,id,'B',10)).toThrow();expect(()=>ins.run(1,id,'C',0)).toThrow()}finally{db.close()}})
 it('confirma fator e código por empresa sem reclassificar vínculos ou alterar saldo',()=>{const db=fixture();try{
 const save=(table:string,data:any)=>{const {id,...values}=data;const keys=Object.keys(values);if(id){db.prepare('UPDATE '+table+' SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...Object.values(values),id);return db.prepare('SELECT * FROM '+table+' WHERE id=?').get(id)}const result=db.prepare('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...Object.values(values));return db.prepare('SELECT * FROM '+table+' WHERE id=?').get(result.lastInsertRowid)}
 const id=db.prepare('SELECT material_id FROM movimentacoes_estoque WHERE id=1').get().material_id
 const payload={empresa_id:1,fornecedor_id:1,material_id:id,codigo:'0007',unidade_comercial:'CX',descricao_origem:'TB PVC 10 UN',fator_num:10,fator_den:1}
 saveMaterialCatalog(db,save,{empresa_id:1,id,atributos:{material:'PVC',aplicacao:'Esgoto'}})
 const before=stockBalance(db,{obra_id:1,material_id:id,unidade:'un'})
 const one=confirmMaterialAlias(db,save,payload,'operador')
 const two=confirmMaterialAlias(db,save,{...payload,fator_num:20,fator_den:2},'operador')
 expect(two.id).toBe(one.id);expect(two.replayed).toBe(true)
 expect(()=>confirmMaterialAlias(db,save,{...payload,fator_num:5},'operador')).toThrow(/diferente/)
 expect(()=>confirmMaterialAlias(db,save,{...payload,fornecedor_id:2},'operador')).toThrow(/outra empresa/)
 expect(materialCatalog(db,{empresa_id:1,q:'0007'}).rows[0].id).toBe(id)
 expect(materialAliases(db,{empresa_id:1,material_id:id}).rows[0].fator_num).toBe(10)
 expect(stockBalance(db,{obra_id:1,material_id:id,unidade:'un'})).toBe(before)
 }finally{db.close()}})
 it('usa índice de material por obra e limita a página em base sintética com 10 mil movimentos',()=>{const db=fixture();try{
 db.transaction(()=>{const insert=db.prepare("INSERT INTO movimentacoes_estoque(obra_id,descricao,unidade,tipo,quantidade,data) VALUES(1,?,'un','entrada',1,'2026-11-25')");for(let i=0;i<10000;i++)insert.run('Material '+(i%250))})()
 const id=db.prepare('SELECT material_id FROM movimentacoes_estoque WHERE id=1').get().material_id
 const plan=db.prepare('EXPLAIN QUERY PLAN SELECT SUM(quantidade) FROM movimentacoes_estoque WHERE obra_id=? AND material_id=?').all(1,id)
 expect(plan.some((r:any)=>String(r.detail).includes('idx_mov_material_obra'))).toBe(true)
 const started=performance.now();const data=stockPage(db,{obra_id:1,limit:50});console.info('[stock-benchmark] 10.000 movimentos / 50 linhas:',(performance.now()-started).toFixed(2),'ms');expect(data.rows).toHaveLength(50);expect(data.total).toBe(252)
 }finally{db.close()}})

 it('reclassifica após prévia atual e preserva histórico e entradas futuras',()=>{const db=fixture();try{
 const save=(table:string,data:any)=>{const keys=Object.keys(data);const result=db.prepare('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...Object.values(data));return db.prepare('SELECT * FROM '+table+' WHERE id=?').get(result.lastInsertRowid)}
 db.prepare("INSERT INTO movimentacoes_estoque(obra_id,descricao,unidade,tipo,quantidade,data) VALUES(1,'TB PVC','un','entrada',3,'2026-11-25')").run()
 const a=db.prepare("SELECT id,uid FROM materiais_estoque WHERE descricao='TB PVC' AND empresa_id=1").get(),b=db.prepare("SELECT material_id id FROM movimentacoes_estoque WHERE id=1").get()
 const payload={empresa_id:1,origem_id:a.id,destino_id:b.id}
 const impact=materialReclassificationPreview(db,payload)
 expect(impact.movimentacoes).toBe(1)
 expect(()=>confirmMaterialReclassification(db,save,{...payload,revision:'stale',motivo:'Mesmo tubo',confirmado:true},'operador')).toThrow(/prévia/)
 confirmMaterialReclassification(db,save,{...payload,revision:impact.revision,motivo:'Mesmo tubo',confirmado:true},'operador')
 expect(stockBalance(db,{obra_id:1,descricao:'TB PVC',unidade:'un'})).toBe(13)
 expect(db.prepare("SELECT descricao,quantidade FROM movimentacoes_estoque WHERE descricao='TB PVC'").get()).toEqual({descricao:'TB PVC',quantidade:3})
 db.prepare("INSERT INTO movimentacoes_estoque(obra_id,descricao,unidade,tipo,quantidade,data) VALUES(1,'TB PVC','un','entrada',1,'2026-11-25')").run()
 expect(stockBalance(db,{obra_id:1,material_id:b.id,unidade:'un'})).toBe(14)
 expect(materialCatalog(db,{empresa_id:1}).rows.some((r:any)=>r.id===a.id)).toBe(false)
 expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
 }finally{db.close()}})
})
