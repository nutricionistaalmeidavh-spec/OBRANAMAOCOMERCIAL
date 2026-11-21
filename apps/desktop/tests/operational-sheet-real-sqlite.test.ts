import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require=createRequire(import.meta.url)
const Database=require('better-sqlite3')
const ExcelJS=require('exceljs')
const {OperationalSheetService}=require('../electron/services/operational-sheet-service.cjs')
const {ProcurementService}=require('../electron/services/procurement-service.cjs')

const cleanup:Array<()=>Promise<void>>=[]
afterEach(async()=>{for(const fn of cleanup.splice(0))await fn()})
const memory=()=>{
  const db=new Database(':memory:')
  cleanup.push(async()=>db.close())
  return db
}
const adapter=(sqlite:any)=>({
  db:sqlite,
  get(table:string,id:number){return sqlite.prepare('SELECT * FROM '+table+' WHERE id=?').get(id)||null},
  save(table:string,data:Record<string,any>){
    const keys=Object.keys(data).filter(key=>key!=='id')
    if(data.id){
      sqlite.prepare('UPDATE '+table+' SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?')
        .run(...keys.map(key=>data[key]),data.id)
      return sqlite.prepare('SELECT * FROM '+table+' WHERE id=?').get(data.id)
    }
    const result=sqlite.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(key=>data[key]))
    return sqlite.prepare('SELECT * FROM '+table+' WHERE id=?').get(result.lastInsertRowid)
  },
  audit(){return null}
})
const service=(sqlite:any,dialog:any={})=>new OperationalSheetService({
  db:adapter(sqlite),
  moduleStorage:{state:()=>({state:'local'})},
  dialog
})
describe('P0 transações canônicas com SQLite real',()=>{
  it('desfaz toda atualização do orçamento quando outra linha é de obra diferente',()=>{
    const sqlite=memory()
    sqlite.exec(`
      CREATE TABLE itens_orcamentarios(id INTEGER PRIMARY KEY,obra_id INTEGER NOT NULL,
        descricao TEXT,quantidade REAL NOT NULL,valor_unitario_centavos INTEGER NOT NULL,
        deleted_at TEXT,updated_at TEXT);
      INSERT INTO itens_orcamentarios(id,obra_id,descricao,quantidade,valor_unitario_centavos)
      VALUES(1,7,'Tubo',1,1000),(2,8,'Registro',2,3000);
    `)
    const sheet=service(sqlite)
    expect(()=>sheet.commit({area:'orcamento',obraId:7,rows:[
      {id:1,descricao:'Tubo editado',quantidade:'0,5',valor_unitario_centavos:2000},
      {id:2,descricao:'Registro',quantidade:'3',valor_unitario_centavos:3000}
    ]})).toThrow(/não pertence à obra/i)
    expect(sqlite.prepare('SELECT descricao,quantidade FROM itens_orcamentarios WHERE id=1').get())
      .toEqual({descricao:'Tubo',quantidade:1})
  })
  it('conserva quantidades decimais válidas no orçamento',()=>{
    const sqlite=memory()
    sqlite.exec("CREATE TABLE itens_orcamentarios(id INTEGER PRIMARY KEY,obra_id INTEGER,descricao TEXT,quantidade REAL,valor_unitario_centavos INTEGER,deleted_at TEXT,updated_at TEXT);INSERT INTO itens_orcamentarios VALUES (1,7,'Tubo',1,1000,NULL,NULL)")
    const result=service(sqlite).commit({area:'orcamento',obraId:7,rows:[{id:1,quantidade:'16,364',valor_unitario_centavos:1055}]})
    expect(result.updated).toBe(1)
    expect(sqlite.prepare('SELECT quantidade,valor_unitario_centavos FROM itens_orcamentarios WHERE id=1').get())
      .toEqual({quantidade:16.364,valor_unitario_centavos:1055})
  })
  it('bloqueia baixas e faz rollback das alterações financeiras anteriores no mesmo lote',()=>{
    const sqlite=memory()
    sqlite.exec(`
      CREATE TABLE contas(id INTEGER PRIMARY KEY,empresa_id INTEGER,status TEXT,origem_tipo TEXT,
        descricao TEXT,valor_centavos INTEGER,valor_bruto_centavos INTEGER,deleted_at TEXT,updated_at TEXT);
      CREATE TABLE pagamentos_conta(id INTEGER PRIMARY KEY,conta_id INTEGER,valor_centavos INTEGER);
      INSERT INTO contas VALUES(1,7,'pendente','manual','Conta A',10000,10000,NULL,NULL);
      INSERT INTO contas VALUES(2,7,'pendente','manual','Conta B',20000,20000,NULL,NULL);
      INSERT INTO pagamentos_conta(conta_id,valor_centavos)VALUES(2,5000);
    `)
    expect(()=>service(sqlite).commit({area:'financeiro',empresaId:7,rows:[
      {id:1,descricao:'Conta alterada',valor_centavos:9000},
      {id:2,descricao:'Conta B',valor_centavos:12000}
    ]})).toThrow(/baixas/i)
    expect(sqlite.prepare('SELECT descricao,valor_centavos FROM contas WHERE id=1').get())
      .toEqual({descricao:'Conta A',valor_centavos:10000})
  })
  it('rejeita salvar em banco local quando domínio do servidor está ativo',()=>{
    const sqlite=memory()
    const blocked=new OperationalSheetService({db:adapter(sqlite),moduleStorage:{state:()=>({state:'central-active'})},dialog:{}})
    expect(()=>blocked.commit({area:'orcamento',obraId:1,rows:[{id:1,quantidade:1,valor_unitario_centavos:20}]})).toThrow(/servidor/i)
  })
})
describe('P0 XLSX/CSV sem serviços externos',()=>{
  it('exporta XLSX com números canônicos e neutralização de fórmulas',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'obra-p0-sheet-'))
    cleanup.push(()=>rm(dir,{force:true,recursive:true}))
    const filepath=join(dir,'estoque.xlsx')
    const sqlite=memory()
    const exporter=service(sqlite,{showSaveDialog:async()=>({filePath:filepath,canceled:false})})
    const result=await exporter.exportFile({area:'estoque',format:'xlsx',columns:[{key:'desc',label:'Descrição'},{key:'qtd',label:'Quantidade'}],
      rows:[{desc:'=HYPERLINK("foo")',qtd:0.5}]})
    expect(result.rows).toBe(1)
    const workbook=new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filepath)
    expect(workbook.worksheets[0].getCell(2,1).value).toBe("\'=HYPERLINK(\"foo\")")
    expect(workbook.worksheets[0].getCell(2,2).value).toBe(.5)
  })
  it('importa apenas para revisão os itens de uma nota com quantidade decimal',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'obra-p0-notas-'))
    cleanup.push(()=>rm(dir,{force:true,recursive:true}))
    const filepath=join(dir,'nota.xlsx')
    const book=new ExcelJS.Workbook()
    const sheet=book.addWorksheet('Itens')
    sheet.addRow(['Descrição','Quantidade','Unidade','Valor unitário'])
    sheet.addRow(['Cabo elétrico','0,5','MT','12,90'])
    await book.xlsx.writeFile(filepath)
    const sqlite=memory()
    const importer=service(sqlite,{showOpenDialog:async()=>({canceled:false,filePaths:[filepath]})})
    const result=await importer.loadNoteItems()
    expect(result.rows).toEqual([{descricao:'Cabo elétrico',quantidade:'0.5',unidade:'MT',valor_unitario:'12,9'}])
  })
  it('lê CSV brasileiro com separador ponto e vírgula e decimal com vírgula',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'obra-p0-notas-csv-'))
    cleanup.push(()=>rm(dir,{force:true,recursive:true}))
    const file=join(dir,'nota.csv')
    await writeFile(file,'\uFEFFDescrição;Quantidade;Unidade;Valor unitário\nCabo elétrico;0,5;MT;12,90\n','utf8')
    const importer=service(memory(),{showOpenDialog:async()=>({canceled:false,filePaths:[file]})})
    const result=await importer.loadNoteItems()
    expect(result.rows).toEqual([{descricao:'Cabo elétrico',quantidade:'0.5',unidade:'MT',valor_unitario:'12,9'}])
  })
  it('gera CSV com conteúdo perigoso escapado',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'obra-p0-csv-'))
    cleanup.push(()=>rm(dir,{force:true,recursive:true}))
    const filepath=join(dir,'compras.csv')
    const exporter=service(memory(),{showSaveDialog:async()=>({filePath:filepath,canceled:false})})
    await exporter.exportFile({area:'compras',format:'csv',columns:[{key:'desc',label:'Item'}],rows:[{desc:'=1+1'}]})
    expect(await readFile(filepath,'utf8')).toContain("'=1+1")
  })
})
describe('P0 recebimento em lote atômico',()=>{
  it('faz rollback de todas as entradas caso a segunda quantidade exceda o pedido',()=>{
    const sqlite=memory()
    sqlite.exec(`
      CREATE TABLE pedidos_compra(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,status TEXT);
      CREATE TABLE pedido_compra_itens(id INTEGER PRIMARY KEY,pedido_compra_id INTEGER,descricao TEXT,unidade TEXT,quantidade_pedida REAL,quantidade_recebida REAL);
      CREATE TABLE recebimentos_materiais(id INTEGER PRIMARY KEY,pedido_compra_id INTEGER,pedido_item_id INTEGER,obra_id INTEGER,frente_id INTEGER,data TEXT,quantidade_pedida REAL,quantidade_recebida REAL,nota_fiscal TEXT,documento_id INTEGER,observacoes TEXT);
      CREATE TABLE movimentacoes_estoque(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,pedido_item_id INTEGER,tipo TEXT,descricao TEXT,unidade TEXT,quantidade REAL CHECK(quantidade>0),data TEXT,documento_id INTEGER,observacoes TEXT);
      INSERT INTO pedidos_compra VALUES (1,7,NULL,'emitido');
      INSERT INTO pedido_compra_itens VALUES(10,1,'Tubo','un',2,0),(11,1,'Registro','un',1,0);
    `)
    const procurement=new ProcurementService({db:adapter(sqlite)})
    expect(()=>procurement.receiveMany({data:'2026-11-20',items:[
      {pedido_item_id:10,quantidade_recebida:2},{pedido_item_id:11,quantidade_recebida:3}
    ]})).toThrow(/excede/i)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM recebimentos_materiais').get().n).toBe(0)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n).toBe(0)
    expect(sqlite.prepare('SELECT quantidade_recebida FROM pedido_compra_itens WHERE id=10').get().quantidade_recebida).toBe(0)
  })
})
