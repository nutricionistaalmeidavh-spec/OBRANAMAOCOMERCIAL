'use strict'
const { createHash }=require('node:crypto')
const sha=v=>createHash('sha256').update(v).digest('hex')
const positiveId=(v,label)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw Error(label+' inválido.');return n}
function dateISO(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Informe a data no formato AAAA-MM-DD.');const ms=Date.parse(s+'T00:00:00.000Z');if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==s)throw Error('Data inválida.');return s}
const nextUTCDate=(date,days)=>new Date(Date.parse(date+'T00:00:00.000Z')+days*86400000).toISOString().slice(0,10)
const actorText=v=>{const s=String(v||'').trim();if(s.length<2||s.length>120)throw Error('Identifique o responsável pela conciliação.');return s}
class BankP0Service{
 constructor({db}){if(!db?.prepare||!db?.exec)throw Error('Banco financeiro indisponível.');this.db=db}
 company(v){const id=positiveId(v,'Empresa');if(!this.db.prepare('SELECT id FROM empresas WHERE id=? AND deleted_at IS NULL').get(id))throw Error('Empresa não encontrada.');return id}
 bankAccount(empresaId,bankId){const id=this.company(empresaId);const b=this.db.prepare('SELECT * FROM contas_bancarias WHERE id=? AND empresa_id=? AND deleted_at IS NULL').get(positiveId(bankId,'Conta bancária'),id);if(!b)throw Error('Conta bancária não encontrada nesta empresa.');return b}
 movement(empresaId,bankId,transactionId){const bank=this.bankAccount(empresaId,bankId);const transaction=this.db.prepare('SELECT * FROM transacoes_bancarias WHERE id=? AND empresa_id=? AND conta_bancaria_id=?').get(positiveId(transactionId,'Movimentação'),bank.empresa_id,bank.id);if(!transaction)throw Error('Movimentação não encontrada nesta conta bancária.');return{bank,transaction}}
 usedTransaction(id){return Number(this.db.prepare("SELECT COALESCE(SUM(a.valor_centavos),0) used FROM reconciliacao_alocacoes a JOIN reconciliacao_lotes l ON l.id=a.lote_id WHERE l.transacao_bancaria_id=? AND l.status='active'").get(id).used||0)}
 usedPayment(id){return Number(this.db.prepare("SELECT COALESCE(SUM(a.valor_centavos),0) used FROM reconciliacao_alocacoes a JOIN reconciliacao_lotes l ON l.id=a.lote_id WHERE a.pagamento_id=? AND l.status='active'").get(id).used||0)}
 findPayment(empresaId,paymentId){const p=this.db.prepare("SELECT p.id,p.conta_id,p.valor_centavos,p.data,c.empresa_id,c.tipo,c.descricao,c.vencimento,c.obra_id FROM pagamentos_conta p JOIN contas c ON c.id=p.conta_id WHERE p.id=? AND c.empresa_id=? AND c.deleted_at IS NULL AND c.status!='cancelado'").get(positiveId(paymentId,'Pagamento'),this.company(empresaId));if(!p)throw Error('Pagamento não encontrado nesta empresa ou já cancelado.');return p}
 suggestReconciliation({empresaId,contaBancariaId,transacaoId,limit=30,includeAll=false}){
  const{transaction}=this.movement(empresaId,contaBancariaId,transacaoId)
  const used=this.usedTransaction(transaction.id), remaining=Math.abs(Number(transaction.valor_centavos))-used,expected=transaction.valor_centavos<0?'pagar':'receber'
  const candidates=this.db.prepare("SELECT p.id pagamento_id,p.conta_id,p.valor_centavos,p.data,c.descricao,c.vencimento,c.tipo,c.obra_id FROM pagamentos_conta p JOIN contas c ON c.id=p.conta_id WHERE c.empresa_id=? AND c.deleted_at IS NULL AND c.status!='cancelado' AND c.tipo=? ORDER BY ABS(julianday(p.data)-julianday(?)),p.id DESC LIMIT 700").all(this.company(empresaId),expected,transaction.data)
  const suggestions=[]
  for(const p of candidates){
   const available=Number(p.valor_centavos)-this.usedPayment(p.pagamento_id);if(available<=0)continue
   const days=Math.abs((Date.parse(String(p.data).slice(0,10)+'T00:00:00Z')-Date.parse(transaction.data+'T00:00:00Z'))/86400000)
   if(!Number.isFinite(days)||(days>14 && includeAll!==true && includeAll!=='true'))continue
   const exact=available===remaining
   const desc=String(transaction.descricao||'').toLowerCase()
   const matched=String(p.descricao||'').toLowerCase().split(/\W+/).filter(w=>w.length>3).some(w=>desc.includes(w))
   const score=(exact?55:0)+(days===0?30:days<=3?20:days<=7?10:0)+(matched?15:0)
   suggestions.push({pagamentoId:p.pagamento_id,contaId:p.conta_id,descricao:p.descricao,data:p.data,obraId:p.obra_id,availableCents:available,score,reason:exact?'Valor correspondente':matched?'Descrição correspondente':'Data próxima'})
  }
  suggestions.sort((a,b)=>b.score-a.score||a.pagamentoId-b.pagamentoId)
  return{transactionId:transaction.id,transactionCents:Number(transaction.valor_centavos),reconciledCents:used,remainingCents:remaining,suggestions:suggestions.slice(0,Math.min(Math.max(Number(limit)||30,1),100))}
 }
 confirmReconciliation(input){
  const{empresaId,contaBancariaId,transacaoId,allocations,requestId,actorId}=input||{}
  const{bank,transaction}=this.movement(empresaId,contaBancariaId,transacaoId)
  const key=String(requestId||'').trim();if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw Error('Identificador de conciliação inválido.')
  const actor=actorText(actorId)
  if(!Array.isArray(allocations)||!allocations.length||allocations.length>100)throw Error('Selecione ao menos um pagamento para conciliar.')
  const clean=allocations.map(x=>{const paymentId=positiveId(x.pagamentoId,'Pagamento'),cents=Number(x.valorCentavos);if(!Number.isSafeInteger(cents)||cents<=0)throw Error('Valor da alocação inválido.');return{paymentId,cents}}).sort((a,b)=>a.paymentId-b.paymentId)
  if(new Set(clean.map(x=>x.paymentId)).size!==clean.length)throw Error('Não repita um pagamento na mesma conciliação.')
  const hash=sha(JSON.stringify([bank.empresa_id,bank.id,transaction.id,clean]))
  const db=this.db;db.exec('BEGIN IMMEDIATE')
  try{
   const prior=db.prepare('SELECT id,payload_hash FROM reconciliacao_lotes WHERE request_id=?').get(key)
   if(prior){if(prior.payload_hash!==hash)throw Error('Identificador de conciliação reutilizado com valores diferentes.');const result=this.reconciliationById(prior.id);db.exec('COMMIT');return result}
   const available=Math.abs(Number(transaction.valor_centavos))-this.usedTransaction(transaction.id)
   const total=clean.reduce((s,x)=>s+x.cents,0)
   if(total>available)throw Error('A conciliação excede o saldo disponível da movimentação bancária.')
   const expected=transaction.valor_centavos<0?'pagar':'receber'
   for(const x of clean){const p=this.findPayment(bank.empresa_id,x.paymentId);if(p.tipo!==expected)throw Error('Tipo do pagamento não corresponde à entrada/saída bancária.');if(x.cents>Number(p.valor_centavos)-this.usedPayment(p.id))throw Error('Alocação excede o saldo disponível do pagamento.')}
   const batch=db.prepare("INSERT INTO reconciliacao_lotes(empresa_id,conta_bancaria_id,transacao_bancaria_id,request_id,payload_hash,status,created_by) VALUES(?,?,?,?,?,'active',?)").run(bank.empresa_id,bank.id,transaction.id,key,hash,actor)
   const batchId=Number(batch.lastInsertRowid),put=db.prepare('INSERT INTO reconciliacao_alocacoes(lote_id,pagamento_id,valor_centavos) VALUES(?,?,?)')
   for(const x of clean)put.run(batchId,x.paymentId,x.cents)
   const result=this.reconciliationById(batchId);db.exec('COMMIT');return result
  }catch(e){try{db.exec('ROLLBACK')}catch{};throw e}
 }
 reconciliationById(id){
  const batch=this.db.prepare('SELECT * FROM reconciliacao_lotes WHERE id=?').get(positiveId(id,'Conciliação'))
  if(!batch)throw Error('Conciliação não encontrada.')
  const entries=this.db.prepare('SELECT a.pagamento_id pagamentoId,a.valor_centavos valorCentavos,c.descricao,p.data,c.obra_id obraId FROM reconciliacao_alocacoes a JOIN pagamentos_conta p ON p.id=a.pagamento_id JOIN contas c ON c.id=p.conta_id WHERE a.lote_id=? ORDER BY a.id').all(id)
  return{id:batch.id,empresaId:batch.empresa_id,contaBancariaId:batch.conta_bancaria_id,transacaoId:batch.transacao_bancaria_id,status:batch.status,createdAt:batch.created_at,createdBy:batch.created_by,reversedAt:batch.reversed_at,reverseReason:batch.reverse_reason,allocatedCents:entries.reduce((s,a)=>s+Number(a.valorCentavos),0),allocations:entries}
 }
 listReconciliations({empresaId,contaBancariaId,transacaoId}={}){
  const bank=this.bankAccount(empresaId,contaBancariaId)
  let sql='SELECT id FROM reconciliacao_lotes WHERE empresa_id=? AND conta_bancaria_id=?'
  const params=[bank.empresa_id,bank.id]
  if(transacaoId!==undefined&&transacaoId!==null&&transacaoId!==''){sql+=' AND transacao_bancaria_id=?';params.push(positiveId(transacaoId,'Movimentação'))}
  return this.db.prepare(sql+' ORDER BY id DESC LIMIT 150').all(...params).map(x=>this.reconciliationById(x.id))
 }
 reverseReconciliation({empresaId,loteId,reason,actorId}={}){
  const companyId=this.company(empresaId),actor=actorText(actorId),note=String(reason||'').trim()
  if(note.length<8||note.length>500)throw Error('Informe uma justificativa de pelo menos 8 caracteres.')
  const db=this.db;db.exec('BEGIN IMMEDIATE')
  try{
   const batch=db.prepare('SELECT * FROM reconciliacao_lotes WHERE id=? AND empresa_id=?').get(positiveId(loteId,'Conciliação'),companyId)
   if(!batch)throw Error('Conciliação não encontrada nesta empresa.')
   if(batch.status==='active')db.prepare("UPDATE reconciliacao_lotes SET status='reversed',reversed_by=?,reversed_at=CURRENT_TIMESTAMP,reverse_reason=? WHERE id=? AND status='active'").run(actor,note,batch.id)
   const result=this.reconciliationById(batch.id);db.exec('COMMIT');return result
  }catch(e){try{db.exec('ROLLBACK')}catch{};throw e}
 }
 cashFlow({empresaId,asOf,horizonDays=30}={}){
  const id=this.company(empresaId),date=dateISO(asOf),horizon=Number(horizonDays)
  if(![30,60,90].includes(horizon))throw Error('Selecione um horizonte de 30, 60 ou 90 dias.')
  const banks=this.db.prepare('SELECT id,nome,banco_nome,saldo_inicial_centavos,saldo_referencia_data,ativo FROM contas_bancarias WHERE empresa_id=? AND deleted_at IS NULL ORDER BY id').all(id)
  if(!banks.length)throw Error('Cadastre uma conta bancária para calcular o saldo e o fluxo de caixa.')
  if(!banks.some(b=>b.saldo_referencia_data<=date))throw Error('Não há conta bancária com data de saldo inicial anterior ou igual à referência.')
  const txQuery=this.db.prepare('SELECT id,data,valor_centavos FROM transacoes_bancarias WHERE empresa_id=? AND conta_bancaria_id=? AND data>? AND data<=? ORDER BY data,id')
  const movements=banks.map(b=>({...b,eligible:b.saldo_referencia_data<=date,txs:txQuery.all(id,b.id,b.saldo_referencia_data,date)}))
  const balanceAt=at=>movements.reduce((sum,b)=>b.saldo_referencia_data>at?sum:sum+Number(b.saldo_inicial_centavos)+b.txs.reduce((n,tx)=>tx.data<=at?n+Number(tx.valor_centavos):n,0),0)
  const realized=balanceAt(date)
  const history=Array.from({length:30},(_,i)=>{
   const current=nextUTCDate(date,i-29)
   const items=movements.flatMap(b=>b.txs.filter(tx=>tx.data===current))
   const covered=movements.every(b=>b.saldo_referencia_data<=current)
   return{date:current,realizedInCents:items.reduce((n,x)=>n+Math.max(0,Number(x.valor_centavos)),0),realizedOutCents:items.reduce((n,x)=>n+Math.max(0,-Number(x.valor_centavos)),0),balanceCents:covered?balanceAt(current):null,coverage:covered?'full':'partial'}
  })
  const obligations=this.db.prepare("SELECT c.id,c.tipo,c.vencimento,c.valor_centavos,COALESCE((SELECT SUM(p.valor_centavos) FROM pagamentos_conta p WHERE p.conta_id=c.id AND p.data<=?),0) paid FROM contas c WHERE c.empresa_id=? AND c.deleted_at IS NULL AND c.status!='cancelado' AND c.tipo IN ('pagar','receber')").all(date,id)
  const tomorrow=nextUTCDate(date,1),last=nextUTCDate(date,horizon),scheduled=new Map()
  let overdues=0
  for(const entry of obligations){
   const outstanding=Math.max(0,Number(entry.valor_centavos)-Number(entry.paid));if(!outstanding)continue
   const dueDate=dateISO(entry.vencimento),effective=dueDate<=date?tomorrow:dueDate
   if(dueDate<=date)overdues++
   if(effective>last)continue
   const bucket=scheduled.get(effective)||{in:0,out:0}
   if(entry.tipo==='receber')bucket.in+=outstanding
   else bucket.out+=outstanding
   scheduled.set(effective,bucket)
  }
  let balance=realized,negativeDays=0,receive=0,pay=0
  const days=Array.from({length:horizon},(_,i)=>{
   const day=nextUTCDate(date,i+1),event=scheduled.get(day)||{in:0,out:0}
   receive+=event.in;pay+=event.out;balance+=event.in-event.out
   if(balance<0)negativeDays++
   return{date:day,projectedInCents:event.in,projectedOutCents:event.out,projectedBalanceCents:balance,negative:balance<0}
  })
  const warnings=[]
  if(movements.some(x=>!x.eligible))warnings.push('Algumas contas não possuem saldo inicial na data de referência e foram excluídas do saldo consolidado.')
  if(movements.some(x=>x.txs.length===0))warnings.push('Existem contas sem movimentações importadas até a data de referência.')
  if(overdues)warnings.push('Contas vencidas e ainda pendentes foram projetadas para o primeiro dia seguinte à referência.')
  return{empresaId:id,asOf:date,horizonDays:horizon,actualSource:'bank_statements',balanceDescription:'Saldo calculado pelo saldo inicial e pelos extratos importados; não é consulta bancária em tempo real.',realizedCents:realized,projectedReceivablesCents:receive,projectedPayablesCents:pay,projectedEndCents:balance,negativeDays,overdueObligations:overdues,history,days,warnings,banks:movements.map(b=>({id:b.id,nome:b.nome,bancoNome:b.banco_nome,referenceDate:b.saldo_referencia_data,active:!!b.ativo,covered:b.eligible,realizedCents:b.eligible?Number(b.saldo_inicial_centavos)+b.txs.reduce((s,tx)=>s+Number(tx.valor_centavos),0):null,importedMovements:b.txs.length}))}
 }
}
module.exports={BankP0Service,dateISO,nextUTCDate}
