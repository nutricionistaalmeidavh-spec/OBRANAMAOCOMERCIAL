import {describe,it,expect,afterEach} from 'vitest'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const Database=require('better-sqlite3')
const {FieldService}=require('../electron/services/field-service.cjs')
const opened:any[]=[]
afterEach(()=>{for(const db of opened.splice(0))db.close()})
function environment(){
  const sql=new Database(':memory:');opened.push(sql)
  sql.exec(`
    CREATE TABLE rdos(id INTEGER PRIMARY KEY,obra_id INTEGER,data TEXT,frente_id INTEGER,atividades TEXT,updated_at TEXT);
    CREATE TABLE rdo_equipe(id INTEGER PRIMARY KEY,rdo_id INTEGER,frente_id INTEGER,funcionario_id INTEGER,nome TEXT,funcao TEXT,horas REAL,custo_centavos INTEGER);
    CREATE TABLE rdo_equipamentos(id INTEGER PRIMARY KEY,rdo_id INTEGER,frente_id INTEGER,nome TEXT,horas_uso REAL,custo_centavos INTEGER);
    CREATE TABLE rdo_ocorrencias(id INTEGER PRIMARY KEY,rdo_id INTEGER,frente_id INTEGER,tipo TEXT,descricao TEXT,status TEXT,responsavel TEXT,prazo TEXT,prioridade TEXT);
    CREATE TABLE rdo_anexos(id INTEGER PRIMARY KEY,rdo_id INTEGER,frente_id INTEGER,documento_id INTEGER);
    CREATE TABLE tarefas_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,rdo_ocorrencia_id INTEGER,origem_tipo TEXT,origem_id INTEGER,titulo TEXT,descricao TEXT,responsavel TEXT,prazo TEXT,prioridade TEXT,status TEXT,concluido_em TEXT,updated_at TEXT,deleted_at TEXT);
  `)
  const db={
    db:sql,audit:()=>{},
    save:(table:string,data:Record<string,any>)=>{
      const keys=Object.keys(data).filter(k=>k!=='id')
      if(data.id){
        sql.prepare('UPDATE '+table+' SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...keys.map(k=>data[k]),data.id)
        return sql.prepare('SELECT * FROM '+table+' WHERE id=?').get(data.id)
      }
      const result=sql.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>data[k]))
      return sql.prepare('SELECT * FROM '+table+' WHERE id=?').get(result.lastInsertRowid)
    }
  }
  return {sql,field:new FieldService({db})}
}
describe('P2 regressão canônica — RDO não reinicia tarefas acompanhadas',()=>{
  it('preserva id, conclusão, responsável e prioridade da pendência ao salvar o mesmo RDO',()=>{
    const {sql,field}=environment()
    const payload={obra_id:15,data:'2026-11-20',atividades:'Instalação de tubos',frente_id:null,
      equipe:[],equipamentos:[],anexos:[],ocorrencias:[{tipo:'falta_material',descricao:'Sem tubos',status:'aberta',responsavel:'Ana',prazo:'2026-11-22',prioridade:'normal'}]}
    const original=field.saveDailyReport(payload)
    const occurrence=sql.prepare('SELECT * FROM rdo_ocorrencias').get()
    const task=sql.prepare('SELECT * FROM tarefas_obra WHERE deleted_at IS NULL').get()
    sql.prepare("UPDATE tarefas_obra SET status='concluida',concluido_em='2026-11-21',responsavel='Bruna',prioridade='urgente',prazo='2026-11-25' WHERE id=?").run(task.id)
    field.saveDailyReport({...payload,id:original.id,atividades:'Instalação concluída',ocorrencias:[occurrence]})
    const updated=sql.prepare('SELECT * FROM tarefas_obra WHERE deleted_at IS NULL').all()
    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({id:task.id,rdo_ocorrencia_id:occurrence.id,status:'concluida',
      concluido_em:'2026-11-21',responsavel:'Bruna',prioridade:'urgente',prazo:'2026-11-25'})
  })
  it('ao resolver ocorrência do RDO, encerra a tarefa derivada sem duplicá-la',()=>{
    const {sql,field}=environment()
    const payload={obra_id:15,data:'2026-11-20',frente_id:null,equipe:[],equipamentos:[],anexos:[],
      ocorrencias:[{tipo:'atraso',descricao:'Sem operador',status:'aberta',responsavel:'Ana',prioridade:'normal'}]}
    const saved=field.saveDailyReport(payload)
    const occurrence=sql.prepare('SELECT * FROM rdo_ocorrencias').get()
    field.saveDailyReport({...payload,id:saved.id,ocorrencias:[{...occurrence,status:'resolvida'}]})
    expect(sql.prepare('SELECT COUNT(*) n FROM tarefas_obra WHERE deleted_at IS NULL').get().n).toBe(0)
    expect(sql.prepare('SELECT COUNT(*) n FROM tarefas_obra').get().n).toBe(1)
  })
})
