import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import bankModule from '../src/bank-finance.cjs'

function fixture(){
 const repo=new LanRepository({filename:':memory:'})
 repo.applyMigrations(path.resolve(import.meta.dirname,'../migrations'))
 const db=repo.connection()
 const companyId=repo.save('empresas',{razao_social:'P2 Engenharia'}).id
 const foreignCompanyId=repo.save('empresas',{razao_social:'Empresa isolada'}).id
 const bank=new bankModule.BankFinanceService({db})
 const a=bank.saveAccount({empresaId:companyId,nome:'Conta principal',bancoNome:'Banco',saldoInicialCentavos:50000,saldoReferenciaData:'2026-11-01',requestId:'p2-bank-account-main'})
 const addObligation=(type,cents,date,company=companyId)=>{
  return Number(db.prepare('INSERT INTO contas(tipo,empresa_id,descricao,competencia,vencimento,valor_centavos,status) VALUES(?,?,?,?,?,?,?)').run(type,company,'Conta P2',date.slice(0,7),date,cents,'pendente').lastInsertRowid)
 }
 const addPayment=(id,cents,date='2026-11-17')=>Number(db.prepare('INSERT INTO pagamentos_conta(conta_id,valor_centavos,data) VALUES(?,?,?)').run(id,cents,date).lastInsertRowid)
 const importCSV=(entries,name='p2.csv')=>{
  const csv='Data;Descricao;Valor;FITID\n'+entries.map((e,i)=>[e.date,e.description,e.amount,e.id||'p2-'+i].join(';')).join('\n')+'\n'
  const input={empresaId:companyId,contaBancariaId:a.id,fileName:name,format:'csv',contentBase64:Buffer.from(csv).toString('base64')}
  const preview=bank.previewImport(input)
  return bank.confirmImport({...input,previewHash:preview.previewHash})
 }
 return{repo,db,companyId,foreignCompanyId,bank,a,addObligation,addPayment,importCSV,close:()=>repo.close()}
}

test('B5 auditoria identifica linhas não conciliadas, total e divergências por período',()=>{
 const f=fixture();try{
  f.importCSV([{date:'18/11/2026',description:'Saída de material',amount:'-100,00'},{date:'19/11/2026',description:'Entrada pendente',amount:'50,00'}])
  const due=f.addObligation('pagar',10000,'2026-11-18'),pay=f.addPayment(due,10000)
  const tx=f.bank.listTransactions({empresaId:f.companyId,contaBancariaId:f.a.id}).find(t=>t.valor_centavos<0)
  f.bank.confirmReconciliation({empresaId:f.companyId,contaBancariaId:f.a.id,transacaoId:tx.id,requestId:'p2-audit-match',actorId:'gestor',allocations:[{pagamentoId:pay,valorCentavos:10000}]})
  const audit=f.bank.auditPeriod({empresaId:f.companyId,period:'2026-11'})
  assert.equal(audit.transactions,2)
  assert.equal(audit.pendingTransactions,1)
  assert.equal(audit.reconciledTransactions,1)
  assert.equal(audit.unreconciledCents,5000)
  assert.equal(audit.rows.length,2)
  assert.throws(()=>f.bank.auditPeriod({empresaId:f.foreignCompanyId,period:'2026-11',contaBancariaId:f.a.id}),/empresa|conta/i)
 }finally{f.close()}
})

test('B5 fechar e reabrir mês audita ações, bloqueia novas importações/conciliacoes e exige motivo',()=>{
 const f=fixture();try{
  f.importCSV([{date:'18/11/2026',description:'Extrato em aberto',amount:'-80,00'}])
  assert.throws(()=>f.bank.closePeriod({empresaId:f.companyId,period:'2026-11',actorId:'gestor',acknowledgePending:false}),/pendências|pendentes/i)
  const closed=f.bank.closePeriod({empresaId:f.companyId,period:'2026-11',actorId:'gestor',acknowledgePending:true})
  assert.equal(closed.status,'closed')
  assert.equal(f.bank.closePeriod({empresaId:f.companyId,period:'2026-11',actorId:'gestor',acknowledgePending:true}).id,closed.id)
  assert.throws(()=>f.importCSV([{date:'20/11/2026',description:'Nova entrada',amount:'2,00'}],'p2-other.csv'),/fechado/i)
  const due=f.addObligation('pagar',8000,'2026-11-18')
  const p=f.addPayment(due,8000)
  const [movement]=f.bank.listTransactions({empresaId:f.companyId,contaBancariaId:f.a.id})
  assert.throws(()=>f.bank.confirmReconciliation({empresaId:f.companyId,contaBancariaId:f.a.id,transacaoId:movement.id,requestId:'p2-reconcile-locked',actorId:'gestor',allocations:[{pagamentoId:p,valorCentavos:8000}]}),/fechado/i)
  assert.throws(()=>f.bank.reopenPeriod({empresaId:f.companyId,period:'2026-11',actorId:'gestor',reason:'curto'}),/justificativa/i)
  const open=f.bank.reopenPeriod({empresaId:f.companyId,period:'2026-11',actorId:'gestor',reason:'Conferir importação faltante'})
  assert.equal(open.status,'open')
  assert.deepEqual(f.bank.periodEvents({empresaId:f.companyId,period:'2026-11'}).map(x=>x.action),['reopened','closed'])
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM pagamentos_conta').get().n,1)
 }finally{f.close()}
})

test('C3 cenários de adiamento, receita e despesa extras são apenas simulados',()=>{
 const f=fixture();try{
  const due=f.addObligation('pagar',30000,'2026-11-20')
  const beforeCount=f.db.prepare('SELECT COUNT(*) n FROM contas').get().n
  const args={empresaId:f.companyId,asOf:'2026-11-18',horizonDays:30}
  const baseline=f.bank.cashFlow(args)
  const scenario=f.bank.simulateCashFlow({...args,shifts:[{contaId:due,newDate:'2026-11-25'}],events:[{date:'2026-11-22',type:'receber',amountCents:10000,description:'Receita hipotética'},{date:'2026-11-23',type:'pagar',amountCents:5000,description:'Despesa hipotética'}]})
  assert.equal(baseline.projectedEndCents,20000)
  assert.equal(scenario.projectedEndCents,25000)
  assert.equal(scenario.days.find(x=>x.date==='2026-11-20').projectedBalanceCents,50000)
  assert.equal(scenario.days.find(x=>x.date==='2026-11-25').projectedBalanceCents,25000)
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM contas').get().n,beforeCount)
  assert.throws(()=>f.bank.simulateCashFlow({...args,shifts:[{contaId:due,newDate:'2026-11-17'}]}),/futura|posterior/i)
  const foreign=f.addObligation('receber',30000,'2026-11-22',f.foreignCompanyId)
  assert.throws(()=>f.bank.simulateCashFlow({...args,shifts:[{contaId:foreign,newDate:'2026-11-28'}]}),/empresa|conta/i)
 }finally{f.close()}
})

test('C4 relatório compara previsto e importado, preserva isolamento e gera alertas internos',()=>{
 const f=fixture();try{
  f.addObligation('pagar',100000,'2026-11-20')
  f.importCSV([{date:'20/11/2026',description:'Fornecedor',amount:'-200,00'}])
  const result=f.bank.cashReport({empresaId:f.companyId,asOf:'2026-11-18',horizonDays:30})
  assert.equal(result.summary.plannedOutCents,100000)
  assert.equal(result.summary.actualOutCents,20000)
  assert.equal(result.days.find(x=>x.date==='2026-11-20').actualOutCents,20000)
  assert.ok(result.alerts.some(x=>x.kind==='negative_cash'))
  assert.ok(result.alerts.some(x=>x.kind==='unreconciled'))
  assert.equal(result.days.length,30)
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM pagamentos_conta').get().n,0)
 }finally{f.close()}
})


test('B5 impede criar conta bancária com referência retroativa a um mês fechado',()=>{
 const f=fixture();try{
  f.bank.closePeriod({empresaId:f.companyId,period:'2026-11',actorId:'gestor',acknowledgePending:true})
  assert.throws(()=>f.bank.saveAccount({empresaId:f.companyId,nome:'Retroativa',bancoNome:'Banco 2',saldoInicialCentavos:1000,saldoReferenciaData:'2026-11-02',requestId:'retroactive-account'}),/fechado/i)
  const after=f.bank.saveAccount({empresaId:f.companyId,nome:'Nova conta',bancoNome:'Banco 2',saldoInicialCentavos:1000,saldoReferenciaData:'2026-12-01',requestId:'future-account'})
  assert.equal(after.saldo_inicial_centavos,1000)
 }finally{f.close()}
})
