import { afterEach,describe,it,expect } from 'vitest'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const Database=require('better-sqlite3')
const {OperationalSheetP2Service,normalizeRdoRows}=require('../electron/services/operational-sheet-p2-service.cjs')
const opened:any[]=[]
afterEach(()=>{for(const db of opened.splice(0))db.close()})
function setup(state='local'){
  const sql=new Database(':memory:');opened.push(sql)
  sql.exec(`
    CREATE TABLE tarefas_obra(
      id INTEGER PRIMARY KEY,obra_id INTEGER NOT NULL,frente_id INTEGER,
      rdo_ocorrencia_id INTEGER,titulo TEXT NOT NULL,descricao TEXT,
      responsavel TEXT,prazo TEXT,prioridade TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'aberta',origem_tipo TEXT NOT NULL DEFAULT 'manual',
      origem_id INTEGER,concluido_em TEXT,updated_at TEXT,deleted_at TEXT
    );
    CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,deleted_at TEXT);
    INSERT INTO frentes_obra VALUES(5,20,NULL),(6,30,NULL);
    INSERT INTO tarefas_obra VALUES
      (1,20,5,NULL,'Conferir estoque','', 'Ana','2026-11-23','normal','aberta','manual',NULL,NULL,'REV-A',NULL),
      (2,20,5,91,'Falta de material','', 'João','2026-11-24','alta','em_andamento','rdo_ocorrencia',91,NULL,'REV-B',NULL),
      (3,30,6,NULL,'Outra obra','', 'Pedro','2026-11-25','normal','aberta','manual',NULL,NULL,'REV-C',NULL);
  `)
  const db={
    db:sql,
    get:(t:string,id:number)=>sql.prepare('SELECT * FROM '+t+' WHERE id=?').get(id),
    save:(t:string,data:any)=>{
      if(t!=='tarefas_obra')throw Error('unexpected table')
      const keys=Object.keys(data).filter(x=>x!=='id')
      sql.prepare('UPDATE '+t+' SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...keys.map(k=>data[k]),data.id)
      return sql.prepare('SELECT * FROM '+t+' WHERE id=?').get(data.id)
    }
  }
  return {sql,service:new OperationalSheetP2Service({db,moduleStorage:{state:()=>({state})},today:()=>'2026-11-20'})}
}
describe('P2 — tarefas canônicas em lote',()=>{
  it('atualiza responsável, prazo, prioridade e status de múltiplas pendências',()=>{
    const {service,sql}=setup()
    const changed=service.commitTasks({obraId:20,rows:[
      {id:1,updated_at:'REV-A',responsavel:'Carla',prazo:'2026-12-01',prioridade:'urgente',status:'concluida'},
      {id:2,updated_at:'REV-B',responsavel:'Marcos',prazo:'2026-12-03',prioridade:'normal',status:'em_andamento'}
    ]})
    expect(changed.updated).toBe(2)
    expect(sql.prepare('SELECT responsavel,prazo,prioridade,status,concluido_em FROM tarefas_obra WHERE id=1').get())
      .toEqual({responsavel:'Carla',prazo:'2026-12-01',prioridade:'urgente',status:'concluida',concluido_em:'2026-11-20'})
    expect(sql.prepare('SELECT rdo_ocorrencia_id,origem_tipo,responsavel FROM tarefas_obra WHERE id=2').get())
      .toEqual({rdo_ocorrencia_id:91,origem_tipo:'rdo_ocorrencia',responsavel:'Marcos'})
  })
  it('desfaz o lote inteiro quando existe tarefa de outra obra',()=>{
    const {service,sql}=setup()
    expect(()=>service.commitTasks({obraId:20,rows:[
      {id:1,updated_at:'REV-A',responsavel:'Alterada',status:'em_andamento'},
      {id:3,updated_at:'REV-C',responsavel:'Inválida',status:'concluida'}
    ]})).toThrow(/obra/i)
    expect(sql.prepare('SELECT responsavel FROM tarefas_obra WHERE id=1').get().responsavel).toBe('Ana')
  })
  it('bloqueia conflito de revisão, prioridades inválidas e IDs repetidos',()=>{
    const {service}=setup()
    expect(()=>service.commitTasks({obraId:20,rows:[{id:1,updated_at:'OLD',status:'aberta'}]})).toThrow(/revisão|alterad/i)
    expect(()=>service.commitTasks({obraId:20,rows:[{id:1,prioridade:'sem_prioridade'}]})).toThrow(/prioridade/i)
    expect(()=>service.commitTasks({obraId:20,rows:[{id:1},{id:1}]})).toThrow(/duplicad/i)
    expect(()=>service.commitTasks({obraId:20,rows:[{id:1,prazo:'2026-02-30'}]})).toThrow(/data|prazo/i)
  })
  it('reabrir tarefa limpa data de conclusão e preserva origem',()=>{
    const {service,sql}=setup()
    service.commitTasks({obraId:20,rows:[{id:1,status:'concluida'}]})
    service.commitTasks({obraId:20,rows:[{id:1,status:'aberta'}]})
    expect(sql.prepare('SELECT concluido_em,origem_tipo FROM tarefas_obra WHERE id=1').get())
      .toEqual({concluido_em:null,origem_tipo:'manual'})
  })
  it('nunca faz fallback para SQLite quando o domínio está em servidor',()=>{
    const {service,sql}=setup('central-active')
    expect(()=>service.commitTasks({obraId:20,rows:[{id:1,responsavel:'Alterado'}]})).toThrow(/servidor/i)
    expect(sql.prepare('SELECT responsavel FROM tarefas_obra WHERE id=1').get().responsavel).toBe('Ana')
  })
})
describe('P2 — planilha auxiliar do RDO',()=>{
  it('normaliza linhas de equipe com decimais pt-BR e sem salvar diretamente',()=>{
    expect(normalizeRdoRows('equipe',[{id:1,nome:'Equipe A',funcao:'Instalador',horas:'0,5',custo:'1.234,50',funcionario_id:'',frente_id:'5'}])).toEqual([
      {id:1,nome:'Equipe A',funcao:'Instalador',horas:'0.5',custo:'1234.50',funcionario_id:'',frente_id:'5',observacoes:''}
    ])
  })
  it('normaliza equipamentos e rejeita horas negativas ou custos com fórmulas',()=>{
    expect(normalizeRdoRows('equipamentos',[{id:1,nome:'Plataforma',horas_uso:'2,5',custo:'19,90'}])[0])
      .toMatchObject({nome:'Plataforma',horas_uso:'2.5',custo:'19.90'})
    expect(()=>normalizeRdoRows('equipamentos',[{id:1,nome:'Plataforma',horas_uso:'-1',custo:'5'}])).toThrow(/horas/i)
    expect(()=>normalizeRdoRows('equipamentos',[{id:1,nome:'Plataforma',horas_uso:'1',custo:'=1+1'}])).toThrow(/custo/i)
  })
  it('não aceita linhas duplicadas ou pessoas sem nome',()=>{
    expect(()=>normalizeRdoRows('equipe',[{id:1,nome:''}])).toThrow(/nome/i)
    expect(()=>normalizeRdoRows('equipe',[{id:1,nome:'A',horas:'1',custo:'2'},{id:1,nome:'B',horas:'1',custo:'2'}])).toThrow(/duplicad/i)
  })
})
