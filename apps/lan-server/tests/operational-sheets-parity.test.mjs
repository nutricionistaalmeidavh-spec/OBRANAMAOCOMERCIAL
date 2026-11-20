import assert from 'node:assert/strict'
import test from 'node:test'
import {once} from 'node:events'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {LanRepository} from '../src/repository.mjs'
import {createLanServer} from '../src/server.mjs'

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
 const permission={operation:{view:true,edit:false},planning:{view:true,edit:false},finance:{view:true,edit:false},rh:{view:true,edit:false}}
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
