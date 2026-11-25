import { describe,it,expect } from 'vitest'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const Database=require('better-sqlite3')
const {stockPage,validateStockMovement}=require('../../../packages/domain-core/index.cjs')
function fixture(){
 const db=new Database(':memory:')
 db.exec("CREATE TABLE obras(id INTEGER PRIMARY KEY,empresa_id INTEGER,nome TEXT,deleted_at TEXT);CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,nome TEXT,deleted_at TEXT);CREATE TABLE movimentacoes_estoque(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,descricao TEXT,unidade TEXT,tipo TEXT,quantidade REAL,data TEXT);INSERT INTO obras VALUES(1,1,'A',NULL),(2,2,'B',NULL);INSERT INTO frentes_obra VALUES(1,1,'Etapa',NULL);INSERT INTO movimentacoes_estoque VALUES(1,1,1,'Tubo','UN','entrada',10,'2026-11-01'),(2,1,1,' tubo ','un','saida',2,'2026-11-02'),(3,2,NULL,'Tubo','un','entrada',40,'2026-11-01');")
 return db
}
describe('estoque canônico',()=>{
 it('separa empresas, agrega unidade e descrição normalizadas e pagina',()=>{const db=fixture();try{expect(stockPage(db,{empresa_id:1}).rows[0].saldo).toBe(8);expect(stockPage(db,{limit:1}).total).toBe(2);expect(stockPage(db,{history:true,limit:1}).rows).toHaveLength(1)}finally{db.close()}})
 it('rejeita saída acima do saldo e etapa de outra obra',()=>{const db=fixture();try{expect(()=>validateStockMovement(db,{obra_id:1,frente_id:1,descricao:'Tubo',unidade:'un',tipo:'saida',quantidade:9})).toThrow();expect(()=>validateStockMovement(db,{obra_id:2,frente_id:1,descricao:'Tubo',unidade:'un',tipo:'entrada',quantidade:1})).toThrow()}finally{db.close()}})
})
