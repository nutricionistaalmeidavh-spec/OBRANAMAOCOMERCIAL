import { FormEvent, useEffect, useState } from 'react'
import { Button, Card, Empty, ErrorState, Field, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

type ManualBalance={id:number;data:string;saldo_centavos:number;justificativa:string;created_by:string;created_at:string}
type Props={empresaId:number;contaBancariaId:number;contaNome:string;saldoInicialData:string;ativo:boolean;revision:number;onSaved:(balance:ManualBalance & {conta_bancaria_id:number})=>void}
const today=()=>{const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')}
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents)/100)
const parseAmount=(value:string)=>{
 const raw=value.replace(/R\$/gi,'').replace(/\s/g,'').trim()
 if(!/^-?\d{1,12}(?:\.\d{3})*(?:,\d{1,2})?$/.test(raw)&&!/^-?\d{1,12}(?:,\d{1,2})?$/.test(raw))throw Error('Informe um valor em reais, por exemplo 1250,90.')
 const cents=Math.round(Number(raw.replace(/\./g,'').replace(',','.'))*100)
 if(!Number.isSafeInteger(cents))throw Error('Saldo fora do limite permitido.')
 return cents
}
export default function BankBalancePanel({empresaId,contaBancariaId,contaNome,saldoInicialData,ativo,revision,onSaved}:Props){
 const [data,setData]=useState(today)
 const [valor,setValor]=useState('')
 const [justificativa,setJustificativa]=useState('')
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID())
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [savedVersion,setSavedVersion]=useState(0)
 const history=useAsync<ManualBalance[]>(()=>window.fluxoDre.bancos.manualBalances({empresaId,contaBancariaId}),[empresaId,contaBancariaId,revision,savedVersion])
 useEffect(()=>{setData(today());setValor('');setJustificativa('');setError('');setMessage('');setRequestId(crypto.randomUUID())},[empresaId,contaBancariaId])
 const resetRequest=()=>{setRequestId(crypto.randomUUID());setError('');setMessage('')}
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setMessage('')
  try{
   if(!ativo)throw Error('A conta deve estar ativa.')
   if(data<saldoInicialData)throw Error('A data não pode ser anterior ao saldo inicial.')
   if(data>today())throw Error('Informe uma data de hoje ou anterior.')
   const response=await window.fluxoDre.bancos.recordBalance({empresaId,contaBancariaId,data,saldoCentavos:parseAmount(valor),justificativa:justificativa.trim(),requestId})
   setMessage('Saldo de '+money(response.saldo_centavos)+' registrado em '+response.data+'. O extrato futuro não repetirá este valor.')
   setValor('');setJustificativa('');setRequestId(crypto.randomUUID())
   setSavedVersion(x=>x+1);onSaved(response)
  }catch(err){setError((err as Error).message)}finally{setBusy(false)}
 }
 return <Card className="bank-import-card bank-manual-balance">
  <h2>Atualizar saldo manualmente — {contaNome}</h2>
  <p>Informe o saldo real do banco ao final de um dia. Isso <strong>não cria receita, despesa nem pagamento</strong>. Extratos importados posteriormente, com movimentos do mesmo dia ou anteriores, continuarão disponíveis para conciliação, mas não serão somados novamente ao saldo.</p>
  <form className="bank-form" onSubmit={e=>void submit(e)}>
   <Field label="Data do saldo (fim do dia)" required><input required type="date" min={saldoInicialData} max={today()} value={data} onChange={e=>{setData(e.target.value);resetRequest()}}/></Field>
   <Field label="Saldo bancário em R$" required><input required placeholder="Ex.: 10.500,00" inputMode="decimal" value={valor} onChange={e=>{setValor(e.target.value);resetRequest()}}/></Field>
   <Field label="Justificativa da conferência" required><input required minLength={8} maxLength={500} placeholder="Ex.: Saldo conferido no aplicativo do banco" value={justificativa} onChange={e=>{setJustificativa(e.target.value);resetRequest()}}/></Field>
   <div className="bank-form-actions"><Button type="submit" disabled={busy||!ativo||!valor||justificativa.trim().length<8}>{busy?'Registrando...':'Confirmar saldo manual'}</Button></div>
  </form>
  {error&&<p className="bank-message bank-error" role="alert">{error}</p>}
  {message&&<p className="bank-message bank-success" role="status">{message}</p>}
  <h3>Histórico de saldos informados</h3>
  {history.loading?<Loading label="Consultando conferências..."/>:history.error?<ErrorState error={history.error} retry={history.reload}/>:!history.data?.length?<Empty title="Nenhum saldo manual informado" description="O saldo inicial permanece como referência até a primeira atualização."/>:<div className="bank-table"><table><thead><tr><th>Data</th><th>Saldo conferido</th><th>Justificativa</th><th>Responsável</th></tr></thead><tbody>{history.data.map(x=><tr key={x.id}><td>{x.data}</td><td>{money(x.saldo_centavos)}</td><td>{x.justificativa}</td><td>{x.created_by}</td></tr>)}</tbody></table></div>}
  <p className="bank-hint">Registros são imutáveis e auditáveis. Para corrigir um valor, registre uma nova conferência na data correspondente; o último registro daquela data prevalece nos cálculos.</p>
 </Card>
}
