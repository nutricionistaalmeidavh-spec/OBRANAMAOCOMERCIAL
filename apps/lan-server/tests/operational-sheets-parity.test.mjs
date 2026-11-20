import assert from 'node:assert/strict'
import test from 'node:test'
import {once} from 'node:events'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {LanRepository} from '../src/repository.mjs'
import {createLanServer} from '../src/server.mjs'
import {OperationalSheetCentral} from '../src/operational-sheet-service.mjs'

const TOKEN='batch-parity-device'
const digest=v=>createHash('sha256').update(v).digest('hex')
function security(permissions=null){
 return {
  serverState:()=>({claimed:true,companyId:'tenant-a'}),
  deviceByTokenHash:hash=>hash===digest(TOKEN)?{id:'device',memberId:'member',status:'active'}:null,
  member:()=>({memberId:'member',role:permissions?'employee':'admin',modules:permissions?['obra360','finance','rh']:[],channels:['desktop'],status:'active',...(permissions?{permissions}:{} )}),
  touchDevice(){}
 }
}
async function setup(permissions=null){
 const repo=new LanRepository({filename:':memory:'})
 repo.applyMigrations(path.resolve(import.meta.dirname,'../migrations'))
 const company=repo.save('empresas',{razao_social:'Teste lote'})
 const work=repo.save('obras',{empresa_id:company.id,nome:'Obra lote'})
 const other=repo.save('obras',{empresa_id:company.id,nome:'Outra obra'})
 const front=repo.save('frentes_obra',{obra_id:work.id,nome:'Hidráulica'})
 const budget=repo.save('itens_orcamentarios',{obra_id:work.id,frente_id:front.id,descricao:'Tubo',unidade:'m',quantidade:5,valor_unitario_centavos:1500,tipo:'material'})
 const second=repo.save('itens_orcamentarios',{obra_id:other.id,descricao:'Fora da obra',unidade:'un',quantidade:1,valor_unitario_centavos:300,tipo:'material'})
 const task=repo.save('tarefas_obra',{obra_id:work.id,titulo:'Pendência manual',origem_tipo:'manual',prioridade:'normal',status:'aberta'})
 const employee=repo.save('funcionarios',{empresa_id:company.id,obra_atual_id:work.id,nome:'Funcionária',status:'ativo'})
 const server=createLanServer({repository:repo,security:security(permissions)})
 server.listen(0,'127.0.0.1');await once(server,'listening')
 const address=server.address()
 return {repo,server,base:'http://127.0.0.1:'+address.port,company,work,other,front,budget,second,task,employee}
}
const headers={'content-type':'application/json',authorization:'Bearer '+TOKEN}
async function call(f,endpoint,payload){
 const res=await fetch(f.base+endpoint,{method:'POST',headers,body:JSON.stringify(payload)})
 return {status:res.status,data:await res.json()}
}
async function close(f){f.server.close();await once(f.server,'close');f.repo.close()}

test('planilha remota: grava em transação e incrementa revisão de orçamento',async()=>{
 const f=await setup()
 try{
  const first=await call(f,'/api/v1/operational-sheets/commit',{area:'orcamento',obraId:f.work.id,rows:[{id:f.budget.id,revision:1,quantidade:2.5,valor_unitario_centavos:2290}]})
  assert.equal(first.status,200,JSON.stringify(first.data))
  assert.equal(f.repo.get('itens_orcamentarios',f.budget.id).quantidade,2.5)
  assert.equal((await (await fetch(f.base+'/api/v1/itens_orcamentarios/'+f.budget.id,{headers})).json()).revision,2)
 }finally{await close(f)}
})
test('lote misturando obras recusa tudo e preserva revisão e saldo',async()=>{
 const f=await setup()
 try{
  const res=await call(f,'/api/v1/operational-sheets/commit',{area:'orcamento',obraId:f.work.id,rows:[
   {id:f.budget.id,revision:1,quantidade:3,valor_unitario_centavos:1200},
   {id:f.second.id,revision:1,quantidade:4,valor_unitario_centavos:1600}
  ]})
  assert.equal(res.status,400)
  assert.equal(f.repo.get('itens_orcamentarios',f.budget.id).quantidade,5)
 }finally{await close(f)}
})
test('conflito de edição de dois computadores retorna 409 e preserva alterações',async()=>{
 const f=await setup()
 try{
  const one={area:'tarefas',obraId:f.work.id,rows:[{id:f.task.id,revision:1,responsavel:'PC A',status:'em_andamento'}]}
  assert.equal((await call(f,'/api/v1/operational-sheets/commit',one)).status,200)
  const stale=await call(f,'/api/v1/operational-sheets/commit',{area:'tarefas',obraId:f.work.id,rows:[{id:f.task.id,revision:1,responsavel:'PC B'}]})
  assert.equal(stale.status,409)
  assert.equal(stale.data.error,'revision_conflict')
  assert.equal(f.repo.get('tarefas_obra',f.task.id).responsavel,'PC A')
 }finally{await close(f)}
})
test('lote exige autorização granular de escrita, não apenas leitura',async()=>{
 const permission={operation:['view'],planning:['view'],finance:['view'],rh:['view']}
 const f=await setup(permission)
 try{
  const res=await call(f,'/api/v1/operational-sheets/commit',{area:'tarefas',obraId:f.work.id,rows:[{id:f.task.id,revision:1,status:'concluida'}]})
  assert.equal(res.status,403)
  assert.equal(f.repo.get('tarefas_obra',f.task.id).status,'aberta')
 }finally{await close(f)}
})
test('matriz central consulta sem criar batidas e confirma edição com validação e revisão mensal',async()=>{
 const f=await setup()
 try{
  const before=f.repo.connection().prepare('SELECT COUNT(*) as n FROM ponto_marcacoes').get().n
  const matrix=await call(f,'/api/v1/operational-sheets/time-matrix',{competencia:'2026-11',obraId:f.work.id})
  assert.equal(matrix.status,200,JSON.stringify(matrix.data))
  assert.equal(matrix.data.rows.length,30)
  assert.equal(f.repo.connection().prepare('SELECT COUNT(*) as n FROM ponto_marcacoes').get().n,before)
  const data={competencia:'2026-11',obraId:f.work.id,rows:[{funcionario_id:f.employee.id,data:'2026-11-20',tipo:'falta',pointRevision:null}]}
  const result=await call(f,'/api/v1/operational-sheets/time-commit',data)
  assert.equal(result.status,200,JSON.stringify(result.data))
  assert.equal(f.repo.connection().prepare("SELECT COUNT(*) as n FROM ponto_marcacoes WHERE tipo='falta'").get().n,1)
  const stale=await call(f,'/api/v1/operational-sheets/time-commit',data)
  assert.equal(stale.status,409)
 }finally{await close(f)}
})

test('conta central paga ou originada de pedido não pode ser regravada em planilha',async()=>{
 const f=await setup()
 try{
  const account=f.repo.save('contas',{tipo:'pagar',empresa_id:f.company.id,obra_id:f.work.id,descricao:'Material',competencia:'2026-11',vencimento:'2026-11-20',valor_centavos:10000,valor_bruto_centavos:10000,status:'pendente',origem_tipo:'manual'})
  const res=await call(f,'/api/v1/operational-sheets/commit',{area:'financeiro',rows:[{id:account.id,revision:1,descricao:'Editado',valor_centavos:4500}]})
  assert.equal(res.status,200,JSON.stringify(res.data))
  assert.equal(f.repo.get('contas',account.id).valor_centavos,4500)
  const paid=f.repo.save('pagamentos_conta',{conta_id:account.id,valor_centavos:1000,data:'2026-11-20'})
  const blocked=await call(f,'/api/v1/operational-sheets/commit',{area:'financeiro',rows:[{id:account.id,revision:2,valor_centavos:6000}]})
  assert.equal(blocked.status,400)
  assert.equal(f.repo.get('contas',account.id).valor_centavos,4500)
 }finally{await close(f)}
})
test('criação em lote de etapa e subetapa valida vínculo e desfaz inserções inválidas',async()=>{
 const f=await setup()
 try{
  const stage=await call(f,'/api/v1/operational-sheets/commit',{area:'etapas',obraId:f.work.id,rows:[{id:null,nome:'Elétrica',ordem:2,status:'ativa'}]})
  assert.equal(stage.status,200,JSON.stringify(stage.data))
  const stageId=stage.data.ids[0]
  const sub=await call(f,'/api/v1/operational-sheets/commit',{area:'subetapas',obraId:f.work.id,rows:[{id:null,nome:'Quadros',frente_id:stageId,ordem:1,status:'ativa',pavimento:'Térreo'}]})
  assert.equal(sub.status,200,JSON.stringify(sub.data))
  const other= f.repo.save('frentes_obra',{obra_id:f.other.id,nome:'Outro prédio'})
  const count=f.repo.connection().prepare('SELECT COUNT(*) n FROM subfrentes_obra').get().n
  const bad=await call(f,'/api/v1/operational-sheets/commit',{area:'subetapas',obraId:f.work.id,rows:[
   {id:null,nome:'Nova',frente_id:stageId},
   {id:null,nome:'Invasão',frente_id:other.id}
  ]})
  assert.equal(bad.status,400)
  assert.equal(f.repo.connection().prepare('SELECT COUNT(*) n FROM subfrentes_obra').get().n,count)
 }finally{await close(f)}
})
test('conflito central RH não sobrescreve a ficha salva no servidor',async()=>{
 const f=await setup()
 try{
  const data={competencia:'2026-11',obraId:f.work.id,rows:[{funcionario_id:f.employee.id,data:'2026-11-20',tipo:'falta',pointRevision:null}]}
  assert.equal((await call(f,'/api/v1/operational-sheets/time-commit',data)).status,200)
  const stale=await call(f,'/api/v1/operational-sheets/time-commit',data)
  assert.equal(stale.status,409,JSON.stringify(stale.data))
  assert.equal(f.repo.connection().prepare('SELECT COUNT(*) n FROM ponto_marcacoes').get().n,1)
 }finally{await close(f)}
})
test('reenvio de recebimento central é idempotente e não duplica estoque',async()=>{
 const f=await setup()
 try{
  const order=f.repo.save('pedidos_compra',{obra_id:f.work.id,descricao:'Pedido teste',status:'emitido',valor_centavos:1000})
  const item=f.repo.save('pedido_compra_itens',{pedido_compra_id:order.id,descricao:'Tubo',unidade:'un',quantidade_pedida:10,quantidade_recebida:0,valor_centavos:1000})
  const input={requestId:'batch-um',data:'2026-11-20',items:[{pedido_item_id:item.id,quantidade_recebida:4}]}
  const first=await call(f,'/api/v1/operational-sheets/receive-many',input)
  assert.equal(first.status,200,JSON.stringify(first.data))
  const repeated=await call(f,'/api/v1/operational-sheets/receive-many',input)
  assert.equal(repeated.status,200,JSON.stringify(repeated.data))
  const invalid=await call(f,'/api/v1/operational-sheets/receive-many',{...input,items:[{pedido_item_id:item.id,quantidade_recebida:5}]})
  assert.equal(invalid.status,400)
  assert.equal(f.repo.connection().prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n,1)
  assert.equal(f.repo.get('pedido_compra_itens',item.id).quantidade_recebida,4)
 }finally{await close(f)}
})

test('auditoria do lote preserva usuário/dispositivo e reverte junto com alteração em caso de falha',async()=>{
 const f=await setup()
 try{
  const db=f.repo.connection()
  db.exec("CREATE TABLE IF NOT EXISTS audit_test(id INTEGER PRIMARY KEY,member_id TEXT,device_id TEXT,action TEXT)")
  const sheets=new OperationalSheetCentral({repository:f.repo,audit:(actor,event)=>{
   db.prepare('INSERT INTO audit_test(member_id,device_id,action) VALUES(?,?,?)')
     .run(actor.member.memberId,actor.device.id,event.action)
  }})
  const actor={member:{memberId:'operator-1'},device:{id:'workstation-4'}}
  const saved=sheets.commit({area:'tarefas',obraId:f.work.id,
    rows:[{id:f.task.id,revision:1,responsavel:'Equipe A'}]},actor)
  assert.equal(saved.updated,1)
  // node:sqlite retorna objetos de linha com protótipo nulo; compare os campos, não o protótipo.
  const auditRow=db.prepare('SELECT member_id,device_id,action FROM audit_test').get()
  assert.deepEqual({...auditRow},
    {member_id:'operator-1',device_id:'workstation-4',action:'operational_sheet.commit'})
  const auditCount=db.prepare('SELECT COUNT(*) n FROM audit_test').get().n
  assert.throws(()=>sheets.commit({area:'tarefas',obraId:f.work.id,
    rows:[{id:f.task.id,revision:2,responsavel:'Equipe B'},{id:999999,revision:1,responsavel:'Inválido'}]},actor))
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit_test').get().n,auditCount)
  assert.equal(f.repo.get('tarefas_obra',f.task.id).responsavel,'Equipe A')
 }finally{await close(f)}
})
