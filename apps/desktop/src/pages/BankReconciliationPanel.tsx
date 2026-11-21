import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, ErrorState, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

type Movement={id:number;data:string;descricao:string;valor_centavos:number;conciliado_centavos:number}
type Candidate={pagamentoId:number;contaId:number;descricao:string;data:string;availableCents:number;obraId?:number;score:number;reason:string}
type Suggestions={transactionId:number;transactionCents:number;reconciledCents:number;remainingCents:number;suggestions:Candidate[]}
type Match={id:number;allocatedCents:number;status:string;createdAt:string;createdBy:string;reverseReason?:string;allocations:{pagamentoId:number;descricao:string;valorCentavos:number}[]}
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100)
function cents(text:string){const value=String(text||'').trim();if(!/^\d{1,12}(?:\.\d{3})*(?:,\d{1,2})?$/.test(value))return NaN;return Math.round(Number(value.replace(/\./g,'').replace(',','.'))*100)}
const amountText=(n:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100)

export default function BankReconciliationPanel({empresaId,contaBancariaId,movements,onChanged}:{empresaId:number;contaBancariaId:number;movements:Movement[];onChanged:()=>void}){
 const [txId,setTxId]=useState('')
 const [includeAll,setIncludeAll]=useState(false)
 const [version,setVersion]=useState(0)
 const [selected,setSelected]=useState<Record<string,string>>({})
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID())
 const [reverseId,setReverseId]=useState<number|null>(null)
 const [reason,setReason]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 useEffect(()=>{if(!movements.length){setTxId('');return}if(!movements.some(m=>String(m.id)===txId))setTxId(String(movements[0].id))},[movements,txId])
 const tx=useMemo(()=>movements.find(m=>String(m.id)===txId),[movements,txId])
 const query={empresaId,contaBancariaId,transacaoId:Number(txId)}
 const suggested=useAsync<Suggestions>(()=>txId?window.fluxoDre.bancos.suggestions({...query,includeAll}):Promise.resolve({transactionId:0,transactionCents:0,reconciledCents:0,remainingCents:0,suggestions:[]}),[empresaId,contaBancariaId,txId,version,includeAll])
 const history=useAsync<Match[]>(()=>window.fluxoDre.bancos.reconciliations({empresaId,contaBancariaId}),[empresaId,contaBancariaId,version])
 useEffect(()=>{setSelected({});setIncludeAll(false);setRequestId(crypto.randomUUID());setError('');setSuccess('')},[empresaId,contaBancariaId,txId])
 const available=suggested.data?.remainingCents??0
 const allocations=Object.entries(selected).map(([paymentId,value])=>({pagamentoId:Number(paymentId),valorCentavos:cents(value)}))
 const valid=allocations.length>0&&allocations.every(x=>Number.isSafeInteger(x.valorCentavos)&&x.valorCentavos>0)&&allocations.reduce((s,x)=>s+x.valorCentavos,0)<=available
 const toggle=(candidate:Candidate,checked:boolean)=>setSelected(prev=>{
  const next={...prev}
  if(!checked){delete next[candidate.pagamentoId];return next}
  const used=Object.values(prev).reduce((s,v)=>s+(cents(v)||0),0)
  next[candidate.pagamentoId]=amountText(Math.min(candidate.availableCents,Math.max(0,available-used)))
  return next
 })
 const confirm=async()=>{
  setBusy(true);setError('');setSuccess('')
  try{
   const result=await window.fluxoDre.bancos.reconcile({...query,requestId,allocations})
   setSuccess('Conciliação #'+result.id+' registrada, sem duplicar pagamentos.')
   setSelected({});setRequestId(crypto.randomUUID());setVersion(v=>v+1);onChanged()
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 const reverse=async()=>{
  if(!reverseId||reason.trim().length<8)return
  if(!window.confirm('Desfazer esta conciliação? Os pagamentos e movimentos bancários serão preservados.'))return
  setBusy(true);setError('');setSuccess('')
  try{
   await window.fluxoDre.bancos.reverse({empresaId,loteId:reverseId,reason})
   setSuccess('Conciliação desfeita e registrada no histórico.');setReverseId(null);setReason('');setVersion(v=>v+1);onChanged()
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 return <Card className="bank-p0-reconciliation">
  <h2>Conciliação bancária</h2>
  <p>Relacione movimentos do banco a pagamentos ou recebimentos que já foram registrados no Financeiro. Nenhuma nova baixa será criada automaticamente.</p>
  {error&&<div role="alert" className="bank-message bank-error">{error}</div>}
  {success&&<div role="status" className="bank-message bank-success">{success}</div>}
  {!movements.length?<Empty title="Sem transações bancárias" description="Importe um OFX ou CSV antes de iniciar a conciliação."/>:<>
   <label className="field bank-p0-select"><span>Movimentação bancária</span>
    <select value={txId} onChange={e=>setTxId(e.target.value)}>
     {movements.map(m=><option key={m.id} value={m.id}>{m.data} · {m.descricao} · {money(m.valor_centavos)}{Number(m.conciliado_centavos)>=Math.abs(m.valor_centavos)?' (conciliado)':''}</option>)}
    </select>
   </label>
   {tx&&<div className="bank-stats"><span><strong>{money(tx.valor_centavos)}</strong> Valor no extrato</span><span><strong>{money(suggested.data?.reconciledCents||0)}</strong> Conciliado</span><span><strong>{money(available)}</strong> Falta conciliar</span></div>}
   <label className="bank-check"><input type="checkbox" checked={includeAll} onChange={e=>setIncludeAll(e.target.checked)}/> Mostrar também pagamentos fora dos últimos 14 dias</label>
   {suggested.loading?<Loading label="Buscando pagamentos compatíveis..."/>:suggested.error?<ErrorState error={suggested.error} retry={suggested.reload}/>:available===0?<div role="status" className="bank-message">Movimentação totalmente conciliada. Consulte o histórico para desfazer, se necessário.</div>:!suggested.data?.suggestions.length?<Empty title="Nenhum pagamento correspondente" description="Registre a baixa em Financeiro > Contas e retorne para vincular o comprovante bancário."/>:<div>
    <h3>Pagamentos sugeridos para conferência</h3>
    <p>Confira data, valor e descrição antes de selecionar. Uma movimentação pode ser dividida entre vários pagamentos.</p>
    <div className="bank-p0-candidates">{suggested.data.suggestions.map(c=><div className="bank-p0-candidate" key={c.pagamentoId}>
     <label><input type="checkbox" checked={Object.hasOwn(selected,String(c.pagamentoId))} onChange={e=>toggle(c,e.target.checked)} disabled={busy}/><span><strong>{c.descricao}</strong><small>{c.data} · disponível: {money(c.availableCents)} · {c.reason}</small></span></label>
     {Object.hasOwn(selected,String(c.pagamentoId))&&<label className="bank-p0-allocation">Valor a conciliar (R$)<input value={selected[c.pagamentoId]} inputMode="decimal" onChange={e=>setSelected(p=>({...p,[c.pagamentoId]:e.target.value}))}/></label>}
    </div>)}</div>
    <div className="bank-form-actions"><span>Alocação selecionada: {allocations.every(x=>Number.isFinite(x.valorCentavos))?money(allocations.reduce((s,x)=>s+x.valorCentavos,0)):'valor inválido'}</span><Button disabled={busy||!valid} onClick={()=>void confirm()}>{busy?'Registrando...':'Confirmar conciliação'}</Button></div>
    {!valid&&allocations.length>0&&<p role="alert">A soma selecionada deve ser maior que zero e não ultrapassar o saldo disponível da movimentação.</p>}
   </div>}
  </>}
  <section className="bank-p0-history">
   <h3>Histórico de conciliações</h3>
   {history.loading?<Loading/>:history.error?<ErrorState error={history.error} retry={history.reload}/>:!history.data?.length?<p>Nenhuma conciliação realizada nesta conta bancária.</p>:history.data.map(match=><div key={match.id} className="bank-p0-history-entry">
    <div><strong>#{match.id} · {money(match.allocatedCents)}</strong><small>{match.status==='active'?'Ativa':'Revertida'} · {match.createdAt}</small></div>
    <small>{match.allocations.map(a=>a.descricao+' ('+money(a.valorCentavos)+')').join(' + ')}</small>
    {match.status==='active'?<Button variant="secondary" disabled={busy} onClick={()=>{setReverseId(match.id);setReason('')}}>Desfazer</Button>:<small>Justificativa: {match.reverseReason}</small>}
   </div>)}
   {reverseId&&<div className="bank-p0-reversal"><label className="field"><span>Justificativa para desfazer (mínimo 8 caracteres)</span><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={2}/></label><div className="bank-form-actions"><Button variant="secondary" disabled={busy} onClick={()=>setReverseId(null)}>Cancelar</Button><Button disabled={busy||reason.trim().length<8} onClick={()=>void reverse()}>Confirmar reversão</Button></div></div>}
  </section>
 </Card>
}
