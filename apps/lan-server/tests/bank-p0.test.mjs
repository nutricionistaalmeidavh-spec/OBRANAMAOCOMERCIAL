import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import bankModule from '../src/bank-finance.cjs'

const { BankFinanceService } = bankModule
function makeFixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const db = repository.connection()
  const companyId = repository.save('empresas',{razao_social:'P0 Construções'}).id
  const otherCompanyId = repository.save('empresas',{razao_social:'Outra empresa'}).id
  const bank = new BankFinanceService({db})
  const account = bank.saveAccount({empresaId:companyId,nome:'Principal',bancoNome:'Banco local',saldoReferenciaData:'2026-11-01',saldoInicialCentavos:100000,requestId:'p0-conta-principal'})
  const addObligation = (tipo, valor, vencimento, empresaId=companyId, descricao='Obrigação') => {
    const id = Number(db.prepare('INSERT INTO contas(tipo,empresa_id,descricao,competencia,vencimento,valor_centavos,status) VALUES(?,?,?,?,?,?,?)').run(tipo,empresaId,descricao,vencimento.slice(0,7),vencimento,valor,'pendente').lastInsertRowid)
    return id
  }
  const addPayment = (contaId, cents, date='2026-11-17') => Number(db.prepare('INSERT INTO pagamentos_conta(conta_id,valor_centavos,data) VALUES(?,?,?)').run(contaId,cents,date).lastInsertRowid)
  const addBankMovement = (rows) => {
    const csv = 'Data;Descricao;Valor;FITID\n' + rows.map((r)=> [r.date,r.description,r.amount,r.fitid].join(';')).join('\n') + '\n'
    const payload = {empresaId:companyId,contaBancariaId:account.id,fileName:'extrato.csv',format:'csv',contentBase64:Buffer.from(csv,'utf8').toString('base64')}
    const preview = bank.previewImport(payload)
    bank.confirmImport({...payload,previewHash:preview.previewHash})
    return bank.listTransactions({empresaId:companyId,contaBancariaId:account.id})
  }
  return {repository,db,companyId,otherCompanyId,account,bank,addObligation,addPayment,addBankMovement,close:()=>repository.close()}
}

test('B3 concilia um débito com dois pagamentos existentes sem criar baixa duplicada e com idempotência',()=>{
  const f=makeFixture()
  try {
    const a=f.addObligation('pagar',10000,'2026-11-17',f.companyId,'Materiais')
    const b=f.addObligation('pagar',5000,'2026-11-17',f.companyId,'Combustível')
    const p1=f.addPayment(a,10000),p2=f.addPayment(b,5000)
    const [tx]=f.addBankMovement([{date:'18/11/2026',description:'Transferência fornecedor',amount:'-150,00',fitid:'PIX-001'}])
    const s=f.bank.suggestReconciliation({empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id})
    assert.equal(s.remainingCents,15000)
    assert.equal(s.suggestions.length,2)
    const payload={empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id,requestId:'reconcile-p0-001',actorId:'admin',allocations:[{pagamentoId:p1,valorCentavos:10000},{pagamentoId:p2,valorCentavos:5000}]}
    const first=f.bank.confirmReconciliation(payload)
    const second=f.bank.confirmReconciliation(payload)
    assert.equal(first.id,second.id)
    assert.equal(first.allocatedCents,15000)
    assert.equal(f.bank.suggestReconciliation({empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id}).remainingCents,0)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM pagamentos_conta').get().n,2)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM reconciliacao_lotes WHERE status=?').get('active').n,1)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM reconciliacao_alocacoes').get().n,2)
    assert.throws(()=>f.bank.confirmReconciliation({...payload,requestId:'reconcile-p0-002'}),/excede|sem saldo|disponível/i)
  } finally {f.close()}
})

test('B3 impede empresa cruzada, tipo invertido e alocação acima do pagamento',()=>{
  const f=makeFixture()
  try {
    const own=f.addObligation('pagar',5000,'2026-11-17')
    const other=f.addObligation('pagar',5000,'2026-11-17',f.otherCompanyId)
    const receivable=f.addObligation('receber',5000,'2026-11-17')
    const ownPayment=f.addPayment(own,5000), otherPayment=f.addPayment(other,5000), wrongType=f.addPayment(receivable,5000)
    const [tx]=f.addBankMovement([{date:'18/11/2026',description:'Pagamento',amount:'-50,00',fitid:'PIX-002'}])
    const base={empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id,actorId:'admin',requestId:'reconcile-test-002'}
    for (const [id,amount] of [[otherPayment,5000],[wrongType,5000],[ownPayment,6000]]) {
      assert.throws(()=>f.bank.confirmReconciliation({...base,requestId:'reconcile-test-'+id+'-'+amount,allocations:[{pagamentoId:id,valorCentavos:amount}]}))
    }
    assert.equal(f.bank.listReconciliations({empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id}).length,0)
  }finally{f.close()}
})

test('B3 desfaz conciliação com justificativa e preserva histórico auditável',()=>{
  const f=makeFixture()
  try{
    const obligation=f.addObligation('receber',8000,'2026-11-17')
    const payment=f.addPayment(obligation,8000)
    const [tx]=f.addBankMovement([{date:'18/11/2026',description:'Recebimento',amount:'80,00',fitid:'PIX-003'}])
    const reconciled=f.bank.confirmReconciliation({empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id,requestId:'reconcile-003',actorId:'admin',allocations:[{pagamentoId:payment,valorCentavos:8000}]})
    assert.throws(()=>f.bank.reverseReconciliation({empresaId:f.companyId,loteId:reconciled.id,actorId:'admin',reason:''}),/justificativa/i)
    const undone=f.bank.reverseReconciliation({empresaId:f.companyId,loteId:reconciled.id,actorId:'admin',reason:'Comprovante de outra conta'})
    assert.equal(undone.status,'reversed')
    assert.equal(f.bank.suggestReconciliation({empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id}).remainingCents,8000)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM pagamentos_conta').get().n,1)
    assert.equal(f.bank.listReconciliations({empresaId:f.companyId,contaBancariaId:f.account.id,transacaoId:tx.id}).length,1)
  }finally{f.close()}
})

test('C0 C1 produz fluxo diário real pelo extrato e previsão sem somar pagamentos duas vezes',()=>{
  const f=makeFixture()
  try{
    const materials=f.addObligation('pagar',15000,'2026-11-19',f.companyId,'Materiais')
    f.addPayment(materials,10000,'2026-11-17')
    f.addObligation('receber',20000,'2026-11-20',f.companyId,'Medição')
    f.addObligation('pagar',30000,'2026-11-21',f.companyId,'Folha')
    f.addBankMovement([
      {date:'16/11/2026',description:'Entrada cliente',amount:'400,00',fitid:'in-001'},
      {date:'17/11/2026',description:'Saída fornecedor',amount:'-150,00',fitid:'out-001'}
    ])
    const result=f.bank.cashFlow({empresaId:f.companyId,asOf:'2026-11-18',horizonDays:30})
    assert.equal(result.realizedCents,125000)
    assert.equal(result.projectedReceivablesCents,20000)
    assert.equal(result.projectedPayablesCents,35000)
    assert.equal(result.projectedEndCents,110000)
    assert.deepEqual(result.days.slice(0,3).map(r=>[r.date,r.projectedBalanceCents]),[
      ['2026-11-19',120000],['2026-11-20',140000],['2026-11-21',110000]
    ])
    assert.equal(result.actualSource,'bank_statements')
    assert.equal(result.negativeDays,0)
  }finally{f.close()}
})

test('C0 C1 não projeta além do saldo sem referência, move vencidos para amanhã e alerta caixa negativo',()=>{
  const f=makeFixture()
  try{
    f.addObligation('pagar',200000,'2026-11-01',f.companyId,'Vencido')
    const flow=f.bank.cashFlow({empresaId:f.companyId,asOf:'2026-11-18',horizonDays:30})
    assert.equal(flow.days[0].projectedOutCents,200000)
    assert.equal(flow.days[0].projectedBalanceCents,-100000)
    assert.equal(flow.negativeDays,30)
    assert.throws(()=>f.bank.cashFlow({empresaId:f.companyId,asOf:'2026-11-18',horizonDays:14}),/30|60|90/)
    assert.throws(()=>f.bank.cashFlow({empresaId:f.otherCompanyId,asOf:'2026-11-18',horizonDays:30}),/conta|saldo|bancária/i)
  }finally{f.close()}
})
