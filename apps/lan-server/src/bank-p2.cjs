'use strict'
const {createHash}=require('node:crypto')
const month=v=>{const s=String(v||'');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))throw Error('Período inválido: AAAA-MM.');return s}
const date=v=>{const s=String(v||'');const d=new Date(s+'T00:00:00.000Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Data inválida.');return s}
const uid=(v,label)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw Error(label+' inválido.');return n}
const actor=v=>{const s=String(v||'').trim();if(s.length<2||s.length>120)throw Error('Identifique o responsável.');return s}
class BankP2Service{
 constructor({db,p0}){if(!db?.prepare||!db?.exec||!p0)throw Error('Serviço bancário indisponível.');this.db=db;this.p0=p0}
 periodStatus({empresaId,period}){
  const id=this.p0.company(empresaId),m=month(period)
  const r=this.db.prepare('SELECT * FROM finance_bank_period_closures WHERE empresa_id=? AND period=?').get(id,m)
  return r?{id:r.id,empresaId:id,period:m,status:r.status,closedBy:r.closed_by,closedAt:r.closed_at,reopenedBy:r.reopened_by,reopenedAt:r.reopened_at,reopenReason:r.reopen_reason,snapshot:JSON.parse(r.audit_snapshot_json)}:{empresaId:id,period:m,status:'open',snapshot:null}
 }
 assertBalanceReference(empresaId,referenceDate){
  const id=this.p0.company(empresaId),dateMonth=date(referenceDate).slice(0,7)
  const closed=this.db.prepare("SELECT period FROM finance_bank_period_closures WHERE empresa_id=? AND status='closed' AND period>=? ORDER BY period LIMIT 1").get(id,dateMonth)
  if(closed)throw Error('Já existe período bancário fechado ('+closed.period+') posterior ou igual à data do saldo inicial. Reabra o período antes de ajustar o saldo.')
 }
 assertOpen(empresaId,dateValue){
  const id=this.p0.company(empresaId),m=date(dateValue).slice(0,7)
  if(this.db.prepare("SELECT id FROM finance_bank_period_closures WHERE empresa_id=? AND period=? AND status='closed'").get(id,m))throw Error('Período bancário '+m+' fechado. Reabra com autorização para modificar extratos ou conciliações.')
 }
 auditPeriod({empresaId,period,contaBancariaId,obraId}={}){
  const id=this.p0.company(empresaId),m=month(period)
  const bank=contaBancariaId===undefined||contaBancariaId===null||contaBancariaId===''?null:this.p0.bankAccount(id,contaBancariaId).id
  const work=obraId===undefined||obraId===null||obraId===''?null:this.p0.work(id,obraId)
  let where="t.empresa_id=? AND substr(t.data,1,7)=?",args=[id,m]
  if(bank!==null){where+=" AND t.conta_bancaria_id=?";args.push(bank)}
  if(work!==null){
   where+=" AND EXISTS (SELECT 1 FROM v_financeiro_banco_apropriado a WHERE a.transacao_id=t.id AND a.empresa_id=? AND a.obra_id=?)"
   args.push(id,work)
  }
  const query="SELECT t.id,t.data,t.descricao,t.valor_centavos,t.conta_bancaria_id,COALESCE((SELECT SUM(a.valor_centavos) FROM reconciliacao_alocacoes a JOIN reconciliacao_lotes l ON l.id=a.lote_id WHERE l.transacao_bancaria_id=t.id AND l.status='active'),0) reconciled_cents FROM transacoes_bancarias t WHERE "+where+" ORDER BY t.data,t.id"
  const rows=this.db.prepare(query).all(...args).map(x=>{
   const n=Math.abs(Number(x.valor_centavos)),matched=Number(x.reconciled_cents),diff=Math.max(0,n-matched)
   return{id:x.id,date:x.data,description:x.descricao,bankId:x.conta_bancaria_id,amountCents:Number(x.valor_centavos),reconciledCents:matched,differenceCents:diff,status:diff===0?'reconciled':matched?'partial':'pending'}
  })
  return{empresaId:id,period:m,bankId:bank,obraId:work,transactions:rows.length,pendingTransactions:rows.filter(x=>x.status==='pending').length,partialTransactions:rows.filter(x=>x.status==='partial').length,reconciledTransactions:rows.filter(x=>x.status==='reconciled').length,unreconciledCents:rows.reduce((s,x)=>s+x.differenceCents,0),bankInCents:rows.reduce((s,x)=>s+Math.max(0,x.amountCents),0),bankOutCents:rows.reduce((s,x)=>s+Math.max(0,-x.amountCents),0),rows}
 }
 periodEvents({empresaId,period}){
  const id=this.p0.company(empresaId),m=month(period)
  return this.db.prepare('SELECT id,action,actor,reason,created_at FROM finance_bank_period_events WHERE empresa_id=? AND period=? ORDER BY id DESC LIMIT 100').all(id,m)
 }
 closePeriod({empresaId,period,actorId,acknowledgePending=false}={}){
  const id=this.p0.company(empresaId),m=month(period),who=actor(actorId),db=this.db
  db.exec('BEGIN IMMEDIATE')
  try{
   const previous=this.periodStatus({empresaId:id,period:m})
   if(previous.status==='closed'){db.exec('COMMIT');return previous}
   const audit=this.auditPeriod({empresaId:id,period:m})
   if(audit.unreconciledCents>0&&acknowledgePending!==true)throw Error('Há pendências de conciliação. Confirme explicitamente o fechamento com pendências.')
   const snapshot=JSON.stringify({transactions:audit.transactions,unreconciledCents:audit.unreconciledCents,bankInCents:audit.bankInCents,bankOutCents:audit.bankOutCents})
   db.prepare("INSERT INTO finance_bank_period_closures(empresa_id,period,status,audit_snapshot_json,closed_by) VALUES(?,?,'closed',?,?) ON CONFLICT(empresa_id,period) DO UPDATE SET status='closed',audit_snapshot_json=excluded.audit_snapshot_json,closed_by=excluded.closed_by,closed_at=CURRENT_TIMESTAMP,reopened_by=NULL,reopened_at=NULL,reopen_reason=NULL").run(id,m,snapshot,who)
   db.prepare("INSERT INTO finance_bank_period_events(empresa_id,period,action,actor,reason,snapshot_json) VALUES(?,?,'closed',?,?,?)").run(id,m,who,audit.unreconciledCents?'Fechado com divergências reconhecidas':null,snapshot)
   const result=this.periodStatus({empresaId:id,period:m});db.exec('COMMIT');return result
  }catch(e){try{db.exec('ROLLBACK')}catch{};throw e}
 }
 reopenPeriod({empresaId,period,actorId,reason}={}){
  const id=this.p0.company(empresaId),m=month(period),who=actor(actorId),why=String(reason||'').trim(),db=this.db
  if(why.length<8||why.length>500)throw Error('Informe uma justificativa de ao menos 8 caracteres.')
  db.exec('BEGIN IMMEDIATE')
  try{
   const old=this.periodStatus({empresaId:id,period:m})
   if(!old.id)throw Error('Período ainda não fechado.')
   if(old.status==='open'){db.exec('COMMIT');return old}
   db.prepare("UPDATE finance_bank_period_closures SET status='open',reopened_by=?,reopened_at=CURRENT_TIMESTAMP,reopen_reason=? WHERE empresa_id=? AND period=?").run(who,why,id,m)
   db.prepare("INSERT INTO finance_bank_period_events(empresa_id,period,action,actor,reason) VALUES(?,?,'reopened',?,?)").run(id,m,who,why)
   const result=this.periodStatus({empresaId:id,period:m});db.exec('COMMIT');return result
  }catch(e){try{db.exec('ROLLBACK')}catch{};throw e}
 }
 simulateCashFlow({empresaId,asOf,horizonDays=30,contaBancariaId,obraId,events=[],shifts=[]}={}){
  const id=this.p0.company(empresaId),base=this.p0.cashFlow({empresaId:id,asOf,horizonDays,contaBancariaId,obraId})
  if(!Array.isArray(events)||!Array.isArray(shifts)||events.length>100||shifts.length>100)throw Error('Limite de 100 eventos e adiamentos por cenário.')
  const start=base.days[0].date,end=base.days[base.days.length-1].date,changes=new Map()
  const move=(d,kind,cents)=>{if(d<start||d>end)return;const row=changes.get(d)||{in:0,out:0};row[kind]+=cents;changes.set(d,row)}
  const used=new Set()
  for(const shift of shifts){
   const key=uid(shift.contaId,'Obrigação')
   if(used.has(key))throw Error('Não repita uma obrigação no cenário.')
   used.add(key)
   const sql="SELECT c.id,c.empresa_id,c.obra_id,c.tipo,c.vencimento,c.valor_centavos,v.conta_bancaria_id,COALESCE((SELECT SUM(p.valor_centavos) FROM pagamentos_conta p WHERE p.conta_id=c.id AND p.data<=?),0) paid FROM contas c LEFT JOIN conta_previsao_bancaria v ON v.conta_id=c.id AND v.empresa_id=c.empresa_id WHERE c.id=? AND c.empresa_id=? AND c.deleted_at IS NULL AND c.status!='cancelado'"
   const item=base.obraId!==null?this.p0.workPlannedAccounts(id,base.obraId,base.asOf,key).map(x=>({...x,id:x.conta_id,paid:x.pago_centavos}))[0]:this.db.prepare(sql).get(base.asOf,key,id)
   if(!item)throw Error('Obrigação não encontrada nesta empresa.')
   if(base.obraId!==null&&item.obra_id!==base.obraId)throw Error('Obrigação fora da obra selecionada.')
   if(base.contaBancariaId!==null&&item.conta_bancaria_id!==base.contaBancariaId)throw Error('Obrigação fora do banco previsto.')
   const newDate=date(shift.newDate)
   if(newDate<start)throw Error('A nova data deve ser futura e posterior à referência.')
   const remaining=Math.max(0,Number(item.valor_centavos)-Number(item.paid))
   if(!remaining)continue
   const original=item.vencimento<=base.asOf?start:date(item.vencimento)
   const kind=item.tipo==='receber'?'in':'out'
   move(original,kind,-remaining);move(newDate,kind,remaining)
  }
  for(const event of events){
   const eventDate=date(event.date),kind=event.type==='receber'?'in':event.type==='pagar'?'out':null
   if(!kind)throw Error('Tipo de cenário inválido.')
   if(eventDate<start||eventDate>end)throw Error('Evento fora da janela de previsão.')
   const cents=Number(event.amountCents)
   if(!Number.isSafeInteger(cents)||cents<=0||cents>1e12)throw Error('Valor hipotético inválido.')
   move(eventDate,kind,cents)
  }
  let balance=base.realizedCents,incoming=0,outgoing=0,negativeDays=0
  const days=base.days.map(x=>{
   const diff=changes.get(x.date)||{in:0,out:0}
   const ins=x.projectedInCents+diff.in,outs=x.projectedOutCents+diff.out
   if(ins<0||outs<0)throw Error('Cenário inválido: resultaria em valor diário negativo.')
   balance+=ins-outs;incoming+=ins;outgoing+=outs;if(balance<0)negativeDays++
   return{date:x.date,projectedInCents:ins,projectedOutCents:outs,projectedBalanceCents:balance,negative:balance<0}
  })
  return{empresaId:id,asOf:base.asOf,horizonDays:base.horizonDays,baseEndCents:base.projectedEndCents,projectedEndCents:balance,deltaCents:balance-base.projectedEndCents,projectedReceivablesCents:incoming,projectedPayablesCents:outgoing,negativeDays,days,simulatedOnly:true,notes:['Cenário temporário: nenhuma obrigação, extrato ou pagamento foi modificado.']}
 }

 forecastRow(row){
  const data=JSON.parse(row.snapshot_json)
  return{id:row.id,empresaId:row.empresa_id,asOf:row.as_of,horizonDays:row.horizon_days,contaBancariaId:row.conta_bancaria_id,obraId:row.obra_id,createdAt:row.created_at,createdBy:row.created_by,status:'frozen',summary:data.summary,days:data.days}
 }
 listForecasts({empresaId,asOf,horizonDays,contaBancariaId,obraId}={}){
  const id=this.p0.company(empresaId)
  const where=['empresa_id=?'],args=[id]
  if(asOf!==undefined&&asOf!==''){where.push('as_of=?');args.push(date(asOf))}
  if(horizonDays!==undefined&&horizonDays!==''){const horizon=Number(horizonDays);if(![30,60,90].includes(horizon))throw Error('Horizonte de previsão inválido.');where.push('horizon_days=?');args.push(horizon)}
  if(contaBancariaId!==undefined&&contaBancariaId!==''){where.push('conta_bancaria_id=?');args.push(this.p0.bankAccount(id,contaBancariaId).id)}
  else where.push('conta_bancaria_id IS NULL')
  if(obraId!==undefined&&obraId!==''){where.push('obra_id=?');args.push(this.p0.work(id,obraId))}
  else where.push('obra_id IS NULL')
  return this.db.prepare('SELECT * FROM finance_bank_forecast_snapshots WHERE '+where.join(' AND ')+' ORDER BY id DESC LIMIT 200').all(...args).map(r=>this.forecastRow(r))
 }
 captureForecast({empresaId,asOf,horizonDays=30,contaBancariaId,obraId,requestId,actorId}={}){
  const id=this.p0.company(empresaId),request=String(requestId||'').trim(),who=actor(actorId)
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(request))throw Error('Identificador de previsão inválido.')
  const flow=this.p0.cashFlow({empresaId:id,asOf,horizonDays,contaBancariaId,obraId})
  const content={summary:{plannedInCents:flow.projectedReceivablesCents,plannedOutCents:flow.projectedPayablesCents,projectedEndCents:flow.projectedEndCents},days:flow.days.map(x=>({date:x.date,plannedInCents:x.projectedInCents,plannedOutCents:x.projectedOutCents,plannedBalanceCents:x.projectedBalanceCents}))}
  const hash=createHash('sha256').update(JSON.stringify([id,flow.asOf,flow.horizonDays,flow.contaBancariaId,flow.obraId])).digest('hex')
  const db=this.db;db.exec('BEGIN IMMEDIATE')
  try{
   const prev=db.prepare('SELECT * FROM finance_bank_forecast_snapshots WHERE request_id=?').get(request)
   if(prev){
    if(prev.scope_hash!==hash)throw Error('Identificador da previsão já utilizado com conteúdo diferente.')
    const result=this.forecastRow(prev);db.exec('COMMIT');return result
   }
   db.prepare('INSERT INTO finance_bank_forecast_snapshots(empresa_id,as_of,horizon_days,conta_bancaria_id,obra_id,request_id,scope_hash,created_by,snapshot_json) VALUES(?,?,?,?,?,?,?,?,?)').run(id,flow.asOf,flow.horizonDays,flow.contaBancariaId,flow.obraId,request,hash,who,JSON.stringify(content))
   const row=db.prepare('SELECT * FROM finance_bank_forecast_snapshots WHERE request_id=?').get(request)
   const result=this.forecastRow(row);db.exec('COMMIT');return result
  }catch(e){try{db.exec('ROLLBACK')}catch{};throw e}
 }

 cashReport({empresaId,asOf,horizonDays=30,contaBancariaId,obraId,snapshotId}={}){
  const id=this.p0.company(empresaId)
  let historical=null
  if(snapshotId!==undefined && snapshotId!==null && snapshotId!==''){
   const row=this.db.prepare('SELECT * FROM finance_bank_forecast_snapshots WHERE id=? AND empresa_id=?').get(uid(snapshotId,'Previsão'),id)
   if(!row)throw Error('Previsão histórica não encontrada nesta empresa.')
   historical=this.forecastRow(row)
  }
  const flow=this.p0.cashFlow({empresaId:id,asOf,horizonDays,contaBancariaId,obraId})
  if(historical&&(historical.asOf!==flow.asOf||historical.horizonDays!==flow.horizonDays||historical.contaBancariaId!==flow.contaBancariaId||historical.obraId!==flow.obraId))throw Error('A previsão histórica não corresponde aos filtros selecionados.')
  const start=flow.days[0].date,end=flow.days[flow.days.length-1].date
  let sql,args
  if(flow.obraId!==null){
   sql="SELECT t.data,t.valor_centavos FROM v_financeiro_banco_apropriado t WHERE t.empresa_id=? AND t.obra_id=? AND t.data>=? AND t.data<=?"
   args=[id,flow.obraId,start,end]
  }else{sql="SELECT t.data,t.valor_centavos FROM transacoes_bancarias t WHERE t.empresa_id=? AND t.data>=? AND t.data<=?";args=[id,start,end]}
  if(flow.contaBancariaId!==null){sql+=" AND t.conta_bancaria_id=?";args.push(flow.contaBancariaId)}
  const byDate=new Map()
  for(const tx of this.db.prepare(sql).all(...args)){const x=byDate.get(tx.data)||{in:0,out:0};x.in+=Math.max(0,Number(tx.valor_centavos));x.out+=Math.max(0,-Number(tx.valor_centavos));byDate.set(tx.data,x)}
  const days=flow.days.map((x,i)=>{const a=byDate.get(x.date)||{in:0,out:0},planned=historical?.days[i]||{plannedInCents:x.projectedInCents,plannedOutCents:x.projectedOutCents,plannedBalanceCents:x.projectedBalanceCents};return{date:x.date,plannedInCents:planned.plannedInCents,plannedOutCents:planned.plannedOutCents,actualInCents:a.in,actualOutCents:a.out,plannedBalanceCents:planned.plannedBalanceCents}})
  const audit=this.auditPeriod({empresaId:id,period:flow.asOf.slice(0,7),contaBancariaId:flow.contaBancariaId||undefined,obraId:flow.obraId||undefined})
  const alerts=[]
  if(flow.negativeDays)alerts.push({kind:'negative_cash',message:'Saldo previsto negativo em '+flow.negativeDays+' dia(s).'})
  if(flow.overdueObligations)alerts.push({kind:'overdue',message:flow.overdueObligations+' obrigação(ões) vencida(s).'})
  if(flow.unassignedObligations)alerts.push({kind:'unassigned_bank',message:flow.unassignedObligations+' obrigação(ões) sem banco planejado.'})
  if(audit.unreconciledCents)alerts.push({kind:'unreconciled',message:'Extrato com '+audit.pendingTransactions+' pendente(s) e '+audit.partialTransactions+' parcial(is) no mês de referência.'})
  return{empresaId:id,asOf:flow.asOf,horizonDays:flow.horizonDays,obraId:flow.obraId,contaBancariaId:flow.contaBancariaId,forecastMode:historical?'frozen':'current_recalculated',forecastSnapshotId:historical?.id||null,forecastCapturedAt:historical?.createdAt||null,forecastCreatedBy:historical?.createdBy||null,summary:{plannedInCents:historical?.summary.plannedInCents??flow.projectedReceivablesCents,plannedOutCents:historical?.summary.plannedOutCents??flow.projectedPayablesCents,actualInCents:days.reduce((s,x)=>s+x.actualInCents,0),actualOutCents:days.reduce((s,x)=>s+x.actualOutCents,0),projectedEndCents:historical?.summary.projectedEndCents??flow.projectedEndCents},alerts,days,limitations:[historical?'Previsto preservado como fotografia imutável do planejamento; realizado atualizado pelos extratos atuais.':'Previsto reconstituído com obrigações atuais; salve uma previsão para comparativo histórico.','Realizado depende da completude dos extratos importados.']}
 }
}
module.exports={BankP2Service,month}
