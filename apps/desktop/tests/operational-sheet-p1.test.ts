import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const Database=require('better-sqlite3')
const { OperationalSheetP1Service }=require('../electron/services/operational-sheet-p1-service.cjs')

const opened:any[]=[]
afterEach(()=>{for(const db of opened.splice(0))db.close()})
function setup(mode='local') {
  const sql=new Database(':memory:');opened.push(sql);sql.pragma('foreign_keys=ON')
  sql.exec(`
    CREATE TABLE obras(id INTEGER PRIMARY KEY,empresa_id INTEGER);
    INSERT INTO obras VALUES(1,3),(2,4);
    CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,nome TEXT,codigo TEXT,ordem INTEGER,status TEXT,observacoes TEXT,updated_at TEXT,deleted_at TEXT,UNIQUE(obra_id,nome));
    INSERT INTO frentes_obra VALUES(10,1,'Hidráulica','H',1,'ativa','',NULL,NULL),(20,2,'Outra','O',2,'ativa','',NULL,NULL);
    CREATE TABLE subfrentes_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,nome TEXT,codigo TEXT,pavimento TEXT,escopo TEXT,ordem INTEGER,status TEXT,observacoes TEXT,updated_at TEXT,deleted_at TEXT);
    INSERT INTO subfrentes_obra VALUES(11,1,10,'Barrilete','B','Cobertura','',1,'ativa','',NULL,NULL);
    CREATE TABLE cronograma_etapas(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,nome TEXT,responsavel TEXT,previsto_inicio TEXT,previsto_fim TEXT,percentual_previsto REAL,percentual_realizado REAL,custo_planejado_centavos INTEGER,custo_realizado_centavos INTEGER,status TEXT,updated_at TEXT,deleted_at TEXT);
    INSERT INTO cronograma_etapas VALUES(1,1,10,'Instalação','João','2026-11-01','2026-11-20',60,20,120000,20000,'em_andamento',NULL,NULL);
    INSERT INTO cronograma_etapas VALUES(2,2,20,'Outra','Ana','2026-11-01','2026-11-20',10,0,1000,0,'pendente',NULL,NULL);
    CREATE TABLE itens_orcamentarios(id INTEGER PRIMARY KEY,obra_id INTEGER,frente_id INTEGER,descricao TEXT,unidade TEXT,quantidade REAL,valor_unitario_centavos INTEGER,deleted_at TEXT);
    INSERT INTO itens_orcamentarios VALUES(101,1,10,'Tubo','m',25,2000,NULL);
    CREATE TABLE medicoes(id INTEGER PRIMARY KEY,obra_id INTEGER,contrato_id INTEGER,competencia TEXT,status TEXT,valor_bruto_centavos INTEGER,deleted_at TEXT);
    INSERT INTO medicoes VALUES(1,1,100,'2026-10','faturada',20000,NULL),(2,1,100,'2026-11','aprovada',30000,NULL);
    CREATE TABLE medicao_itens(id INTEGER PRIMARY KEY,medicao_id INTEGER,item_orcamentario_id INTEGER,quantidade_periodo REAL,valor_periodo_centavos INTEGER);
    INSERT INTO medicao_itens VALUES(1,1,101,10,20000),(2,2,101,15,30000);
    CREATE TABLE contratos_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,numero TEXT,valor_centavos INTEGER,status TEXT,deleted_at TEXT);
    INSERT INTO contratos_obra VALUES(100,1,'C-1',90000,'ativo',NULL);
    CREATE TABLE contrato_aditivos(id INTEGER PRIMARY KEY,contrato_id INTEGER,valor_centavos INTEGER,status TEXT);
    INSERT INTO contrato_aditivos VALUES(1,100,10000,'aprovado');
    CREATE TABLE funcionarios(id INTEGER PRIMARY KEY,empresa_id INTEGER,obra_atual_id INTEGER,nome TEXT,status TEXT,deleted_at TEXT);
    INSERT INTO funcionarios VALUES(50,3,1,'Maria','ativo',NULL),(60,4,2,'Pedro','ativo',NULL);
    CREATE TABLE pontos_mensais(id INTEGER PRIMARY KEY,funcionario_id INTEGER,competencia TEXT,status TEXT,updated_at TEXT);
    INSERT INTO pontos_mensais VALUES(1000,50,'2026-11','rascunho',NULL);
    CREATE TABLE ponto_marcacoes(id INTEGER PRIMARY KEY,ponto_mensal_id INTEGER,data TEXT,tipo TEXT,entrada TEXT,intervalo_saida TEXT,intervalo_entrada TEXT,saida TEXT,observacoes TEXT,updated_at TEXT,UNIQUE(ponto_mensal_id,data));
    INSERT INTO ponto_marcacoes VALUES(1,1000,'2026-11-04','trabalho','07:00','11:00','12:00','17:00','',NULL);
    CREATE TABLE pagamentos_funcionario(id INTEGER PRIMARY KEY,funcionario_id INTEGER,competencia TEXT,status TEXT);
  `)
  const db={
    db:sql,get:(table:string,id:number)=>sql.prepare('SELECT * FROM '+table+' WHERE id=?').get(id),
    save:(table:string,data:any)=>{
      const keys=Object.keys(data).filter(k=>k!=='id')
      if(data.id){
        sql.prepare('UPDATE '+table+' SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...keys.map(k=>data[k]),data.id)
        return sql.prepare('SELECT * FROM '+table+' WHERE id=?').get(data.id)
      }
      const result=sql.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>data[k]))
      return sql.prepare('SELECT * FROM '+table+' WHERE id=?').get(result.lastInsertRowid)
    }
  }
  const timeService={save:({funcionario_id,competencia,marks}:any)=>{
    const point=sql.prepare('SELECT id FROM pontos_mensais WHERE funcionario_id=? AND competencia=?').get(funcionario_id,competencia)
    if(!point)throw Error('ponto inexistente')
    for(const m of marks){
      sql.prepare('INSERT INTO ponto_marcacoes(ponto_mensal_id,data,tipo,entrada,intervalo_saida,intervalo_entrada,saida,observacoes) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(ponto_mensal_id,data) DO UPDATE SET tipo=excluded.tipo,entrada=excluded.entrada,intervalo_saida=excluded.intervalo_saida,intervalo_entrada=excluded.intervalo_entrada,saida=excluded.saida,observacoes=excluded.observacoes')
      // fixture does not define the unique index; use actual update of a prior mark
      .run(point.id,m.data,m.tipo,m.entrada,m.intervalo_saida,m.intervalo_entrada,m.saida,m.observacoes||'')
    }
    return true
  }}
  const service=new OperationalSheetP1Service({db,moduleStorage:{state:()=>({state:mode})},timeService})
  return {sql,service}
}
describe('P1 — cronograma e estrutura canônica',()=>{
  it('atualiza programação vinculada à etapa correta e bloqueia intervalo invertido',()=>{
    const {sql,service}=setup()
    expect(()=>service.commit({area:'cronograma',obraId:1,rows:[{id:1,nome:'Instalação',frente_id:10,previsto_inicio:'2026-11-21',previsto_fim:'2026-11-20',percentual_previsto:50,percentual_realizado:30,status:'em_andamento'}]})).toThrow(/data|início|fim/i)
    expect(sql.prepare('SELECT previsto_inicio FROM cronograma_etapas WHERE id=1').get().previsto_inicio).toBe('2026-11-01')
    const result=service.commit({area:'cronograma',obraId:1,rows:[{id:1,nome:'Instalação hidráulica',frente_id:10,previsto_inicio:'2026-11-01',previsto_fim:'2026-11-29',percentual_previsto:75,percentual_realizado:40,status:'em_andamento',responsavel:'João'}]})
    expect(result.updated).toBe(1)
    expect(sql.prepare('SELECT percentual_realizado FROM cronograma_etapas WHERE id=1').get().percentual_realizado).toBe(40)
  })
  it('exige formulário individual para mudar a etapa vinculada ao planejamento',()=>{
    const {service,sql}=setup()
    sql.exec("INSERT INTO frentes_obra VALUES(30,1,'Elétrica','EL',3,'ativa','',NULL,NULL)")
    expect(()=>service.commit({area:'cronograma',obraId:1,rows:[
      {id:1,nome:'Instalação',frente_id:30,percentual_realizado:35}
    ]})).toThrow(/formulário individual|planejamento/i)
    expect(sql.prepare('SELECT frente_id FROM cronograma_etapas WHERE id=1').get().frente_id).toBe(10)
  })
  it('faz rollback quando uma etapa do lote pertence a outra obra',()=>{
    const {sql,service}=setup()
    expect(()=>service.commit({area:'cronograma',obraId:1,rows:[
      {id:1,nome:'Alterada',frente_id:10,percentual_realizado:55},
      {id:2,nome:'Outra',frente_id:20,percentual_realizado:30}
    ]})).toThrow(/obra/i)
    expect(sql.prepare('SELECT nome FROM cronograma_etapas WHERE id=1').get().nome).toBe('Instalação')
  })
  it('cria novas etapas e subetapas preservando vínculo e rejeita etapa de outra obra',()=>{
    const {sql,service}=setup()
    const created=service.commit({area:'etapas',obraId:1,rows:[{id:null,nome:'Elétrica',codigo:'EL',ordem:2,status:'ativa'}]})
    const frontId=created.ids[0]
    expect(sql.prepare('SELECT obra_id,nome FROM frentes_obra WHERE id=?').get(frontId)).toEqual({obra_id:1,nome:'Elétrica'})
    const sub=service.commit({area:'subetapas',obraId:1,rows:[{id:null,frente_id:frontId,nome:'Quadros',pavimento:'Térreo',ordem:1,status:'ativa'}]})
    expect(sql.prepare('SELECT frente_id FROM subfrentes_obra WHERE id=?').get(sub.ids[0]).frente_id).toBe(frontId)
    expect(()=>service.commit({area:'subetapas',obraId:1,rows:[{id:null,frente_id:20,nome:'Inválida'}]})).toThrow(/etapa|obra/i)
  })
})
describe('P1 — medição por orçamento e contrato',()=>{
  it('calcula quantidade do mês, acumulado, saldo e valor aprovado ainda não faturado',()=>{
    const {service}=setup()
    const result=service.measurementOverview({obraId:1,competencia:'2026-11'})
    expect(result.items[0]).toMatchObject({item_orcamentario_id:101,quantidade_periodo:15,quantidade_acumulada:25,saldo_a_medir:0,valor_a_faturar_centavos:30000})
    expect(result.contracts[0]).toMatchObject({contrato_id:100,total_contratado_centavos:100000,faturado_centavos:20000,saldo_contratual_centavos:80000})
  })
  it('não inventa saldo contratual para item orçamentário não vinculado a contrato',()=>{
    const {service}=setup()
    expect(service.measurementOverview({obraId:1,competencia:'2026-11'}).items[0].saldo_contratual).toBeNull()
  })
})
describe('P1 — matriz de ponto',()=>{
  it('exibe funcionários/dias sem criar marcações na consulta e calcula horas reais',()=>{
    const {service,sql}=setup()
    const before=sql.prepare('SELECT COUNT(*) n FROM ponto_marcacoes').get().n
    const result=service.timeMatrix({competencia:'2026-11',obraId:1})
    expect(result.rows).toHaveLength(30)
    expect(result.rows.find((r:any)=>r.data==='2026-11-04')).toMatchObject({funcionario_id:50,horas:9,tipo:'trabalho'})
    expect(sql.prepare('SELECT COUNT(*) n FROM ponto_marcacoes').get().n).toBe(before)
  })
  it('não grava dias fora da competência nem funcionário de outra obra',()=>{
    const {service,sql}=setup()
    expect(()=>service.commitTime({competencia:'2026-11',obraId:1,rows:[{funcionario_id:50,data:'2026-12-01',tipo:'falta'}]})).toThrow(/competência|data/i)
    expect(()=>service.commitTime({competencia:'2026-11',obraId:1,rows:[{funcionario_id:60,data:'2026-11-05',tipo:'falta'}]})).toThrow(/obra/i)
    expect(sql.prepare('SELECT COUNT(*) n FROM ponto_marcacoes').get().n).toBe(1)
  })
  it('salva duas marcações da mesma competência na fonte canônica',()=>{
    const {service,sql}=setup()
    const result=service.commitTime({competencia:'2026-11',obraId:1,rows:[
      {funcionario_id:50,data:'2026-11-04',tipo:'trabalho',entrada:'08:00',intervalo_saida:'12:00',intervalo_entrada:'13:00',saida:'17:00'},
      {funcionario_id:50,data:'2026-11-05',tipo:'falta',observacoes:'Falta justificada'}
    ]})
    expect(result).toEqual({updated:2,employees:1})
    expect(sql.prepare("SELECT entrada FROM ponto_marcacoes WHERE data='2026-11-04'").get().entrada).toBe('08:00')
    expect(sql.prepare("SELECT tipo FROM ponto_marcacoes WHERE data='2026-11-05'").get().tipo).toBe('falta')
  })
  it('desfaz alteração de outro dia se um registro do lote pertence a outra obra',()=>{
    const {service,sql}=setup()
    expect(()=>service.commitTime({competencia:'2026-11',obraId:1,rows:[
      {funcionario_id:50,data:'2026-11-04',tipo:'falta'},
      {funcionario_id:60,data:'2026-11-05',tipo:'falta'}
    ]})).toThrow(/obra/i)
    expect(sql.prepare("SELECT tipo FROM ponto_marcacoes WHERE data='2026-11-04'").get().tipo).toBe('trabalho')
  })
  it('impede edição em lote no modo servidor, sem fallback para SQLite',()=>{
    const {service}=setup('central-active')
    expect(()=>service.commit({area:'etapas',obraId:1,rows:[{id:10,nome:'Hidráulica'}]})).toThrow(/servidor/i)
    expect(()=>service.timeMatrix({competencia:'2026-11'})).toThrow(/servidor/i)
  })
})
