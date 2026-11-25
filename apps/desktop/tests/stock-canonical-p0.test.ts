import { describe,it,expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const Database=require('better-sqlite3')
const {stockPage,validateStockMovement}=require('../../../packages/domain-core/index.cjs')
function fixture(){
 const db=new Database(':memory:')
 db.exec("CREATE TABLE empresas(id INTEGER PRIMARY KEY,nome_fantasia TEXT,razao_social TEXT);INSERT INTO empresas VALUES(1,NULL,'Empresa A'),(2,NULL,'Empresa B');CREATE TABLE fornecedores(id INTEGER PRIMARY KEY,empresa_id INTEGER,deleted_at TEXT);CREATE TABLE pedidos_compra(id INTEGER PRIMARY KEY,obra_id INTEGER);CREATE TABLE pedido_compra_itens(id INTEGER PRIMARY KEY,pedido_compra_id INTEGER,descricao TEXT,unidade TEXT,quantidade_pedida REAL,valor_centavos INTEGER);CREATE TABLE obras(id INTEGER PRIMARY KEY,empresa_id INTEGER,nome TEXT,deleted_at TEXT);CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,nome TEXT,deleted_at TEXT);CREATE TABLE movimentacoes_estoque(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,descricao TEXT,unidade TEXT,tipo TEXT,quantidade REAL,data TEXT,pedido_item_id INTEGER);INSERT INTO obras VALUES(1,1,'A',NULL),(2,2,'B',NULL);INSERT INTO frentes_obra VALUES(1,1,'Etapa',NULL);INSERT INTO movimentacoes_estoque VALUES(1,1,1,'Tubo','UN','entrada',10,'2026-11-01',NULL),(2,1,1,' tubo ','un','saida',2,'2026-11-02',NULL),(3,2,NULL,'Tubo','un','entrada',40,'2026-11-01',NULL);")
 for(const name of ['029_material_catalog.sql','030_stock_revision.sql','031_material_reclassification.sql'])db.exec(readFileSync(resolve(import.meta.dirname,'../database/migrations',name),'utf8'))
 return db
}
describe('estoque canônico',()=>{
 it('separa empresas, agrega unidade e descrição normalizadas e pagina',()=>{const db=fixture();try{expect(stockPage(db,{empresa_id:1}).rows[0].saldo).toBe(8);expect(stockPage(db,{limit:1}).total).toBe(2);expect(stockPage(db,{history:true,limit:1}).rows).toHaveLength(1)}finally{db.close()}})
 it('rejeita saída acima do saldo e etapa de outra obra',()=>{const db=fixture();try{expect(()=>validateStockMovement(db,{obra_id:1,frente_id:1,descricao:'Tubo',unidade:'un',tipo:'saida',quantidade:9})).toThrow();expect(()=>validateStockMovement(db,{obra_id:2,frente_id:1,descricao:'Tubo',unidade:'un',tipo:'entrada',quantidade:1})).toThrow()}finally{db.close()}})
 it('trata etapa como apropriação e mantém saldo físico único por obra',()=>{const db=fixture();try{
 db.exec("INSERT INTO frentes_obra VALUES(2,1,'Outra etapa',NULL);INSERT INTO movimentacoes_estoque(id,obra_id,frente_id,descricao,unidade,tipo,quantidade,data,pedido_item_id) VALUES(4,1,2,'Tubo','un','entrada',5,'2026-11-03',NULL);")
 expect(stockPage(db,{obra_id:1}).rows).toHaveLength(1)
 expect(stockPage(db,{obra_id:1}).rows[0].saldo).toBe(13)
 expect(stockPage(db,{obra_id:1,frente_id:1}).rows[0]).toMatchObject({saldo:13,entradas:10,saidas:2,liquido_etapa:8})
 expect(()=>validateStockMovement(db,{obra_id:1,frente_id:2,descricao:'Tubo',unidade:'un',tipo:'saida',quantidade:12})).not.toThrow()
 expect(()=>validateStockMovement(db,{obra_id:1,frente_id:2,descricao:'Tubo',unidade:'un',tipo:'saida',quantidade:14})).toThrow()
 }finally{db.close()}})

})
