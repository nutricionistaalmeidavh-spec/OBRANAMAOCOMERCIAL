import { useState } from 'react'
import { Button, Card, Field, Loading, ErrorState } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

type AuditRow={id:number;date:string;description:string;bankId:number;amountCents:number;reconciledCents:number;differenceCents:number;status:string}
type Audit={transactions:number;pendingTransactions:number;partialTransactions:number;reconciledTransactions:number;unreconciledCents:number;bankInCents:number;bankOutCents:number;rows:AuditRow[]}
type Closure={id?:number;status:'closed'|'open';period:string;closedBy?:string;closedAt?:string;reopenReason?:string}
type Event={id:number;action:'closed'|'reopened';actor:string;reason?:string;created_at:string}
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100)
const currentMonth=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0')].join('-')}

export default function BankPeriodAuditPanel({empresaId,works,banks}:{empresaId:number;works:{id:number;nome:string}[];banks:{id:number;nome:string}[]}){
 const [period,setPeriod]=useState(currentMonth)
 const [bankId,setBankId]=useState('')
 const [obraId,setObraId]=useState('')
 const [reason,setReason]=useState('')
 const [acknowledge,setAcknowledge]=useState(false)
 const [busy,setBusy]=useState(false)
 const [version,setVersion]=useState(0)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const scope={empresaId,period,contaBancariaId:bankId?Number(bankId):undefined,obraId:obraId?Number(obraId):undefined}
 const audit=useAsync<Audit>(()=>window.fluxoDre.bancos.audit(scope),[empresaId,period,bankId,obraId,version])
 const closure=useAsync<Closure>(()=>window.fluxoDre.bancos.periodStatus({empresaId,period}),[empresaId,period,version])
 const history=useAsync<Event[]>(()=>window.fluxoDre.bancos.periodEvents({empresaId,period}),[empresaId,period,version])
 const refresh=()=>{setVersion(x=>x+1);setAcknowledge(false);setReason('')}
 const close=async()=>{
  if(closure.data?.status==='closed')return
  if(!window.confirm('Fechar o módulo bancário de '+period+' para toda a empresa? Novos extratos e conciliações desse mês serão bloqueados até reabertura.'))return
  setBusy(true);setError('');setMessage('')
  try{
   await window.fluxoDre.bancos.closePeriod({empresaId,period,acknowledgePending:acknowledge})
   setMessage('Período bancário fechado. Histórico de auditoria preservado.');refresh()
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const reopen=async()=>{
  if(reason.trim().length<8)return
  if(!window.confirm('Reabrir o período bancário? A operação será auditada.'))return
  setBusy(true);setError('');setMessage('')
  try{await window.fluxoDre.bancos.reopenPeriod({empresaId,period,reason});setMessage('Período bancário reaberto.');refresh()}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <Card className="bank-import-card bank-audit">
  <h2>Auditoria e fechamento bancário</h2>
  <p>Confira transações não conciliadas, parciais e seus valores. O fechamento bloqueia somente novas importações e mudanças em conciliações bancárias daquele mês; não fecha a folha nem outras contas operacionais.</p>
  <div className="cash-filters">
   <Field label="Mês de referência"><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></Field>
   <Field label="Banco (apenas relatório)"><select value={bankId} onChange={e=>setBankId(e.target.value)}><option value="">Todos os bancos</option>{banks.map(b=><option key={b.id} value={b.id}>{b.nome}</option>)}</select></Field>
   <Field label="Obra (apenas relatório)"><select value={obraId} onChange={e=>setObraId(e.target.value)}><option value="">Todas</option>{works.map(w=><option key={w.id} value={w.id}>{w.nome}</option>)}</select></Field>
  </div>
  {error&&<p className="bank-message bank-error" role="alert">{error}</p>}
  {message&&<p className="bank-message bank-success" role="status">{message}</p>}
  {audit.loading||closure.loading?<Loading label="Calculando auditoria bancária..."/>:audit.error?<ErrorState error={audit.error} retry={audit.reload}/>:closure.error?<ErrorState error={closure.error} retry={closure.reload}/>:audit.data&&<>
   <div className="bank-stats">
    <span><strong>{audit.data.transactions}</strong> Movimentações</span>
    <span><strong>{audit.data.reconciledTransactions}</strong> Conciliadas</span>
    <span><strong>{audit.data.partialTransactions}</strong> Parciais</span>
    <span><strong>{audit.data.pendingTransactions}</strong> Pendentes</span>
   </div>
   <p><strong>Divergência pendente: {money(audit.data.unreconciledCents)}</strong> · Entradas: {money(audit.data.bankInCents)} · Saídas: {money(audit.data.bankOutCents)}</p>
   <p>Situação do mês para a empresa: <strong>{closure.data?.status==='closed'?'Fechado':'Aberto'}</strong>. Os filtros acima não alteram o escopo do fechamento, que é sempre por empresa e mês.</p>
   {closure.data?.status==='closed'?<div className="bank-p0-reversal">
    <p>Fechado por {closure.data.closedBy||'responsável'} em {closure.data.closedAt||'data registrada'}.</p>
    <Field label="Justificativa da reabertura"><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="Explique por que o período precisa ser reaberto."/></Field>
    <div className="bank-form-actions"><Button disabled={busy||reason.trim().length<8} onClick={()=>void reopen()}>Reabrir período bancário</Button></div>
   </div>:<div>
    {audit.data.unreconciledCents>0&&<label className="bank-check"><input type="checkbox" checked={acknowledge} onChange={e=>setAcknowledge(e.target.checked)}/> Reconheço que existem divergências e quero fechar mesmo assim.</label>}
    <div className="bank-form-actions"><Button disabled={busy||!!audit.data.unreconciledCents&&!acknowledge} onClick={()=>void close()}>Fechar mês bancário da empresa</Button></div>
   </div>}
   <div className="bank-table cash-table"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Conciliado</th><th>Pendente</th></tr></thead><tbody>{audit.data.rows.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.description}</td><td>{money(r.amountCents)}</td><td>{money(r.reconciledCents)}</td><td>{money(r.differenceCents)}</td></tr>)}</tbody></table></div>
  </>}
  <h3>Histórico de fechamento e reabertura</h3>
  {history.loading?<Loading/>:history.data?.length?<div className="bank-table"><table><thead><tr><th>Data</th><th>Ação</th><th>Responsável</th><th>Justificativa</th></tr></thead><tbody>{history.data.map(x=><tr key={x.id}><td>{x.created_at}</td><td>{x.action==='closed'?'Fechamento':'Reabertura'}</td><td>{x.actor}</td><td>{x.reason||'—'}</td></tr>)}</tbody></table></div>:<p>Nenhum fechamento registrado.</p>}
 </Card>
}
