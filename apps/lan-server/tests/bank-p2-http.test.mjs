import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

test('P2 LAN: relatório, cenário sem escrita, fechamento/reabertura com autoria do servidor',async()=>{
 const repository=new LanRepository({filename:':memory:'})
 repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'))
 const company=repository.save('empresas',{razao_social:'Obras P2'})
 const db=repository.connection()
 const token='p2-lan-token',digest=createHash('sha256').update(token).digest('hex')
 const security={
  serverState:()=>({claimed:true,companyId:'company-owner'}),
  deviceByTokenHash:x=>x===digest?{id:'device-p2',memberId:'admin-p2',status:'active'}:null,
  member:x=>x==='admin-p2'?{role:'admin',status:'active',modules:['finance'],channels:['desktop']}:null,
  touchDevice:()=>{}
 }
 const server=createLanServer({repository,security})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const root='http://127.0.0.1:'+server.address().port
 const call=(endpoint,method='GET',body)=>fetch(root+endpoint,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})
 const bankInfo={empresaId:company.id,nome:'Banco P2',bancoNome:'Banco teste',saldoInicialCentavos:100000,saldoReferenciaData:'2026-11-01',requestId:'bank-p2-http-created'}
 try{
  const saved=await call('/api/v1/finance/bank-accounts','POST',bankInfo)
  assert.equal(saved.status,201)
  const account=await saved.json()
  const invoiceId=Number(db.prepare("INSERT INTO contas(tipo,empresa_id,descricao,competencia,vencimento,valor_centavos,status) VALUES('pagar',?,'Material P2','2026-11','2026-11-20',30000,'pendente')").run(company.id).lastInsertRowid)
  const filters='?empresaId='+company.id+'&asOf=2026-11-18&horizonDays=30'
  const report=await call('/api/v1/finance/cash-report'+filters)
  assert.equal(report.status,200)
  assert.equal((await report.json()).summary.plannedOutCents,30000)
  const simulation=await call('/api/v1/finance/cash-simulate','POST',{empresaId:company.id,asOf:'2026-11-18',horizonDays:30,shifts:[{contaId:invoiceId,newDate:'2026-11-25'}],events:[{date:'2026-11-22',type:'receber',amountCents:5000}]})
  assert.equal(simulation.status,200)
  assert.equal((await simulation.json()).deltaCents,5000)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pagamentos_conta').get().n,0)
  const importData={empresaId:company.id,contaBancariaId:account.id,fileName:'month.csv',format:'csv',contentBase64:Buffer.from('Data;Descricao;Valor\n18/11/2026;Comprovante;-10,00\n').toString('base64')}
  const pre=await call('/api/v1/finance/bank-imports/preview','POST',importData)
  const imported=await call('/api/v1/finance/bank-imports/confirm','POST',{...importData,previewHash:(await pre.json()).previewHash})
  assert.equal(imported.status,200)
  const close=await call('/api/v1/finance/bank-period/close','POST',{empresaId:company.id,period:'2026-11',actorId:'forged-user',acknowledgePending:true})
  assert.equal(close.status,200)
  const closed=await close.json()
  assert.equal(closed.status,'closed')
  assert.equal(closed.closedBy,'device-p2')
  const status=await call('/api/v1/finance/bank-period/status?empresaId='+company.id+'&period=2026-11')
  assert.equal((await status.json()).status,'closed')
  const change={...importData,fileName:'other.csv',contentBase64:Buffer.from('Data;Descricao;Valor\n19/11/2026;Outro;-5,00\n').toString('base64')}
  const prev=await call('/api/v1/finance/bank-imports/preview','POST',change)
  const denied=await call('/api/v1/finance/bank-imports/confirm','POST',{...change,previewHash:(await prev.json()).previewHash})
  assert.notEqual(denied.status,200)
  const reopen=await call('/api/v1/finance/bank-period/reopen','POST',{empresaId:company.id,period:'2026-11',actorId:'forged-user',reason:'Corrigir extrato bancário'})
  assert.equal(reopen.status,200)
  assert.equal((await reopen.json()).reopenedBy,'device-p2')
  const events=await call('/api/v1/finance/bank-period/events?empresaId='+company.id+'&period=2026-11')
  assert.deepEqual((await events.json()).map(x=>x.action),['reopened','closed'])
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contas').get().n,1)
 }finally{await new Promise(resolve=>server.close(resolve));repository.close()}
})
