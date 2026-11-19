import { useEffect, useState } from 'react'
import { Button, Card, ErrorState, Field, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

type ReportDay={date:string;plannedInCents:number;plannedOutCents:number;actualInCents:number;actualOutCents:number;plannedBalanceCents:number}
type Report={summary:{plannedInCents:number;plannedOutCents:number;actualInCents:number;actualOutCents:number;projectedEndCents:number};alerts:{kind:string;message:string}[];limitations:string[];days:ReportDay[]}
type Scenario={baseEndCents:number;projectedEndCents:number;deltaCents:number;negativeDays:number;simulatedOnly:boolean;days:{date:string;projectedInCents:number;projectedOutCents:number;projectedBalanceCents:number}[]}
type Planned={conta_id:number;descricao:string;vencimento:string;tipo:string;pendente_centavos:number;conta_bancaria_id:number|null}
type Event={key:string;date:string;type:'pagar'|'receber';amount:string;description:string}
type Shift={key:string;contaId:string;newDate:string}
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100)
const id=()=>crypto.randomUUID()
const parseMoney=(input:string)=>{
 const text=String(input||'').trim().replace(/\s/g,'')
 if(!/^\d{1,12}(?:\.\d{3})*(?:,\d{1,2})?$/.test(text)&&!/^\d{1,12}(?:,\d{1,2})?$/.test(text))throw Error('Informe valor positivo em reais, ex.: 1.250,50.')
 const n=Math.round(Number(text.replace(/\./g,'').replace(',','.'))*100)
 if(!Number.isSafeInteger(n)||n<=0)throw Error('Valor da simulação deve ser positivo.')
 return n
}
function exportCSV(data:Report){
 const rows=[['Data','Entrada prevista (R$)','Saída prevista (R$)','Entrada realizada (R$)','Saída realizada (R$)','Saldo projetado (R$)'],...data.days.map(x=>[x.date,x.plannedInCents,x.plannedOutCents,x.actualInCents,x.actualOutCents,x.plannedBalanceCents].map((v,i)=>i===0?String(v):(Number(v)/100).toFixed(2).replace('.',',')))]
 const content='\uFEFF'+rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n')
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}))
 const link=document.createElement('a');link.href=url;link.download='fluxo-de-caixa-previsto-vs-realizado.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export default function CashAdvancedPanel({empresaId,asOf,horizonDays,contaBancariaId,obraId,revision}:{empresaId:number;asOf:string;horizonDays:number;contaBancariaId?:number;obraId?:number;revision:number}){
 const filters={empresaId,asOf,horizonDays,contaBancariaId,obraId}
 const [events,setEvents]=useState<Event[]>([])
 const [shifts,setShifts]=useState<Shift[]>([])
 const [scenario,setScenario]=useState<Scenario|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const report=useAsync<Report>(()=>window.fluxoDre.bancos.cashReport(filters),[empresaId,asOf,horizonDays,contaBancariaId,obraId,revision])
 const planned=useAsync<Planned[]>(()=>window.fluxoDre.bancos.planned({empresaId,obraId,asOf}),[empresaId,obraId,asOf,revision])
 const futureStart=(()=>{const d=new Date(asOf+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)})()
 useEffect(()=>{setScenario(null);setError('');setEvents([]);setShifts([])},[empresaId,asOf,horizonDays,contaBancariaId,obraId])
 const editEvent=(key:string,patch:Partial<Event>)=>setEvents(old=>old.map(e=>e.key===key?{...e,...patch}:e))
 const editShift=(key:string,patch:Partial<Shift>)=>setShifts(old=>old.map(e=>e.key===key?{...e,...patch}:e))
 const simulate=async()=>{
  setBusy(true);setError('')
  try{
   const payload={...filters,events:events.map(x=>({date:x.date,type:x.type,amountCents:parseMoney(x.amount),description:x.description})),shifts:shifts.map(x=>({contaId:Number(x.contaId),newDate:x.newDate}))}
   if(shifts.some(x=>!x.contaId))throw Error('Selecione uma obrigação para cada adiamento.')
   setScenario(await window.fluxoDre.bancos.simulateCash(payload))
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="bank-advanced">
  <Card className="bank-import-card bank-p2-report">
   <h2>Relatório — previsto × realizado</h2>
   <p>Utiliza os filtros atuais de empresa, obra e banco. Previsto calculado pelas obrigações cadastradas; realizado obtido dos extratos importados ou conciliações atribuídas.</p>
   {report.loading?<Loading label="Preparando comparativo..."/>:report.error?<ErrorState error={report.error} retry={report.reload}/>:report.data&&<>
    <div className="cash-summary-grid">
     <div className="bank-account-card"><small>Entradas previstas</small><strong>{money(report.data.summary.plannedInCents)}</strong></div>
     <div className="bank-account-card"><small>Entradas realizadas</small><strong>{money(report.data.summary.actualInCents)}</strong></div>
     <div className="bank-account-card"><small>Saídas previstas</small><strong>{money(report.data.summary.plannedOutCents)}</strong></div>
     <div className="bank-account-card"><small>Saídas realizadas</small><strong>{money(report.data.summary.actualOutCents)}</strong></div>
    </div>
    {report.data.alerts.length>0&&<div className="bank-alerts" aria-label="Alertas financeiros">{report.data.alerts.map((a,i)=><p key={i} className="bank-invalid" role="status">{a.message}</p>)}</div>}
    <div className="bank-form-actions"><Button variant="secondary" onClick={()=>exportCSV(report.data!)}>Exportar CSV</Button><Button variant="secondary" onClick={()=>window.print()}>Imprimir / salvar PDF</Button></div>
    <div className="bank-table cash-table"><table><thead><tr><th>Dia</th><th>Entrada prevista</th><th>Entrada realizada</th><th>Saída prevista</th><th>Saída realizada</th></tr></thead><tbody>{report.data.days.map(x=><tr key={x.date}><td>{x.date}</td><td>{money(x.plannedInCents)}</td><td>{money(x.actualInCents)}</td><td>{money(x.plannedOutCents)}</td><td>{money(x.actualOutCents)}</td></tr>)}</tbody></table></div>
    {report.data.limitations.map((text,i)=><p key={i} className="bank-hint">{text}</p>)}
   </>}
  </Card>
  <Card className="bank-import-card bank-p2-scenarios">
   <h2>Simulador de cenários financeiros</h2>
   <p>Experimente adiar obrigações ou acrescentar receitas/despesas hipotéticas. <strong>Nenhum dado real será alterado.</strong></p>
   {error&&<p role="alert" className="bank-message bank-error">{error}</p>}
   <div className="bank-sim-heading"><h3>Eventos hipotéticos</h3><Button variant="secondary" onClick={()=>setEvents(x=>[...x,{key:id(),date:futureStart,type:'pagar',amount:'0,00',description:''}])}>Adicionar evento</Button></div>
   {events.map((e)=><div key={e.key} className="bank-sim-row">
    <Field label="Tipo"><select value={e.type} onChange={x=>editEvent(e.key,{type:x.target.value as Event['type']})}><option value="pagar">Saída</option><option value="receber">Entrada</option></select></Field>
    <Field label="Data"><input type="date" min={futureStart} value={e.date} onChange={x=>editEvent(e.key,{date:x.target.value})}/></Field>
    <Field label="Valor (R$)"><input inputMode="decimal" value={e.amount} onChange={x=>editEvent(e.key,{amount:x.target.value})}/></Field>
    <Field label="Descrição"><input value={e.description} maxLength={120} onChange={x=>editEvent(e.key,{description:x.target.value})} placeholder="Hipótese"/></Field>
    <Button variant="secondary" onClick={()=>setEvents(x=>x.filter(y=>y.key!==e.key))}>Excluir</Button>
   </div>)}
   <div className="bank-sim-heading"><h3>Adiamento de obrigações existentes</h3><Button variant="secondary" onClick={()=>setShifts(x=>[...x,{key:id(),contaId:'',newDate:futureStart}])}>Adicionar adiamento</Button></div>
   {shifts.map(s=><div className="bank-sim-row bank-sim-shift" key={s.key}>
    <Field label="Obrigação a adiar"><select value={s.contaId} onChange={e=>editShift(s.key,{contaId:e.target.value})}><option value="">Selecione</option>{planned.data?.filter(x=>x.pendente_centavos>0 && (contaBancariaId===undefined || x.conta_bancaria_id===contaBancariaId)).map(p=><option key={p.conta_id} value={p.conta_id}>{p.descricao} · {p.vencimento} · {money(p.pendente_centavos)}</option>)}</select></Field>
    <Field label="Nova data"><input type="date" min={futureStart} value={s.newDate} onChange={e=>editShift(s.key,{newDate:e.target.value})}/></Field>
    <Button variant="secondary" onClick={()=>setShifts(x=>x.filter(y=>y.key!==s.key))}>Excluir</Button>
   </div>)}
   <div className="bank-form-actions"><Button variant="secondary" onClick={()=>{setEvents([]);setShifts([]);setScenario(null);setError('')}}>Limpar cenário</Button><Button disabled={busy||(!events.length&&!shifts.length)} onClick={()=>void simulate()}>{busy?'Calculando...':'Simular sem salvar'}</Button></div>
   {scenario&&<div className="bank-sim-result" role="status">
    <h3>Comparação do cenário</h3>
    <div className="bank-stats"><span><strong>{money(scenario.baseEndCents)}</strong> Original</span><span><strong>{money(scenario.projectedEndCents)}</strong> Simulado</span><span><strong>{money(scenario.deltaCents)}</strong> Diferença</span><span><strong>{scenario.negativeDays}</strong> Dias negativos</span></div>
    <p>Este resultado é somente uma simulação. Contas, pagamentos, bancos e extratos reais permanecem inalterados.</p>
   </div>}
  </Card>
 </div>
}
