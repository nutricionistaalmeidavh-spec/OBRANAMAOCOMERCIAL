import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, RefreshCw } from 'lucide-react'
import { Button, Card, Empty, ErrorState, Field, Loading, PageHeader } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { ROUTES } from '../routes/registry'
import './BankAccountsPage.css'
import PlannedBankPanel from './PlannedBankPanel'

type Day={date:string;projectedInCents:number;projectedOutCents:number;projectedBalanceCents:number;negative:boolean}
type HistoryDay={date:string;realizedInCents:number;realizedOutCents:number;balanceCents:number|null;coverage:string}
type CashFlow={
 empresaId:number;asOf:string;horizonDays:number;actualSource:string;balanceDescription:string;realizedCents:number;realizedBasis:'work_attributed'|'bank_balance';hasBankBalance:boolean;unassignedObligations:number;
 projectedReceivablesCents:number;projectedPayablesCents:number;projectedEndCents:number;negativeDays:number;
 overdueObligations:number;history:HistoryDay[];days:Day[];warnings:string[];
 banks:{id:number;nome:string;bancoNome:string;referenceDate:string;active:boolean;covered:boolean;realizedCents:number|null;importedMovements:number}[]
}
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100)
const displayDate=(v:string)=>{const [y,m,d]=v.split('-');return d&&m?d+'/'+m+'/'+y:v}
const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function BalanceChart({days}:{days:Day[]}){
 const points=useMemo(()=>{
  const samples=days.map(x=>x.projectedBalanceCents)
  const min=Math.min(...samples,0),max=Math.max(...samples,0),span=Math.max(1,max-min)
  return samples.map((value,i)=>({x:35+(i/Math.max(samples.length-1,1))*730,y:190-((value-min)/span)*145,value}))
 },[days])
 const path=points.map((p,i)=>(i===0?'M ':'L ')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')
 if(!days.length)return null
 return <svg className="cash-chart" viewBox="0 0 800 220" role="img" aria-label={'Projeção do saldo diário nos próximos '+days.length+' dias'}>
  <line x1="35" y1="190" x2="766" y2="190" stroke="currentColor" opacity=".18"/>
  <line x1="35" y1="45" x2="766" y2="45" stroke="currentColor" opacity=".12"/>
  <path d={path} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
  {points.filter((p,i)=>i===0||i===points.length-1||days[i].negative&&!days[i-1]?.negative).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4.5" fill={p.value<0?'#b91c1c':'#2563eb'}/>)}
  <text x="35" y="210" fill="currentColor" fontSize="13">{displayDate(days[0].date)}</text>
  <text x="766" y="210" textAnchor="end" fill="currentColor" fontSize="13">{displayDate(days[days.length-1].date)}</text>
 </svg>
}
export default function CashFlowPage(){
 const [empresaId,setEmpresaId]=useState('')
 const [asOf,setAsOf]=useState(dateToday)
 const [horizonDays,setHorizonDays]=useState(30)
 const [bankId,setBankId]=useState('')
 const [workId,setWorkId]=useState('')
 const [reload,setReload]=useState(0)
 const companies=useAsync<any[]>(()=>window.fluxoDre.empresas.list(),[])
 const selectedEmpresa=empresaId||String(companies.data?.[0]?.id||'')
 const works=useAsync<{id:number;nome:string}[]>(()=>selectedEmpresa?window.fluxoDre.bancos.works({empresaId:Number(selectedEmpresa)}):Promise.resolve([]),[selectedEmpresa])
 const accounts=useAsync<{id:number;nome:string;banco_nome:string}[]>(()=>selectedEmpresa?window.fluxoDre.bancos.list(Number(selectedEmpresa)):Promise.resolve([]),[selectedEmpresa])
 const cash=useAsync<CashFlow|undefined>(()=>selectedEmpresa?window.fluxoDre.bancos.cashFlow({empresaId:Number(selectedEmpresa),asOf,horizonDays,contaBancariaId:bankId?Number(bankId):undefined,obraId:workId?Number(workId):undefined}):Promise.resolve(undefined),[selectedEmpresa,asOf,horizonDays,bankId,workId,reload])
 const negative=cash.data?.days.find(x=>x.negative)
 return <div className="bank-finance">
  <PageHeader title="Fluxo de caixa" description="Saldos baseados nos extratos importados e projeções das contas a pagar e receber." actions={<Button variant="secondary" icon={<RefreshCw size={16}/>} onClick={()=>setReload(v=>v+1)}>Atualizar</Button>}/>
  <Card className="cash-filters">
   <Field label="Empresa"><select value={selectedEmpresa} onChange={e=>{setEmpresaId(e.target.value);setBankId('');setWorkId('')}}>{companies.data?.map(c=><option key={c.id} value={c.id}>{c.nome_fantasia||c.razao_social}</option>)}</select></Field>
   <Field label="Obra"><select value={workId} onChange={e=>setWorkId(e.target.value)}><option value="">Todas as obras + administrativo</option>{works.data?.map(w=><option key={w.id} value={w.id}>{w.nome}</option>)}</select></Field>
   <Field label="Conta bancária"><select value={bankId} onChange={e=>setBankId(e.target.value)}><option value="">Todas as contas</option>{accounts.data?.map(b=><option key={b.id} value={b.id}>{b.nome} · {b.banco_nome}</option>)}</select></Field>
   <Field label="Data de referência"><input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></Field>
   <Field label="Previsão"><select value={horizonDays} onChange={e=>setHorizonDays(Number(e.target.value))}><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option></select></Field>
  </Card>
  {!selectedEmpresa?<Empty title="Nenhuma empresa cadastrada" description="Cadastre uma empresa antes de consultar o fluxo financeiro."/>:cash.loading?<Loading label="Calculando caixa consolidado..."/>:cash.error?<Card><ErrorState error={cash.error} retry={cash.reload}/><p>Para começar, cadastre uma conta bancária, informe o saldo de referência e importe os extratos.</p><Link to={ROUTES.bankAccounts}>Ir para contas bancárias</Link></Card>:!cash.data?<Empty title="Sem dados financeiros"/>:<>
   <div className="cash-summary-grid">
    <Card><small>{cash.data?.hasBankBalance?'Saldo realizado por extratos':'Movimentação líquida atribuída à obra'}</small><strong>{money(cash.data.realizedCents)}</strong><small>Até {displayDate(cash.data.asOf)}</small></Card>
    <Card><small>Recebimentos previstos</small><strong>{money(cash.data.projectedReceivablesCents)}</strong><small>Nos próximos {horizonDays} dias</small></Card>
    <Card><small>Pagamentos previstos</small><strong>{money(cash.data.projectedPayablesCents)}</strong><small>Nos próximos {horizonDays} dias</small></Card>
    <Card><small>{cash.data?.hasBankBalance?'Saldo final projetado':'Resultado gerencial projetado da obra'}</small><strong className={cash.data.projectedEndCents<0?'cash-negative':''}>{money(cash.data.projectedEndCents)}</strong><small>{displayDate(cash.data.days[cash.data.days.length-1].date)}</small></Card>
   </div>
   <Card className="bank-import-card">
    <h2>{cash.data?.hasBankBalance?'Saldo projetado — evolução diária':'Resultado gerencial projetado — evolução diária'}</h2>
    <p>{cash.data.balanceDescription}</p>
    {cash.data.negativeDays>0&&<p className="cash-alert" role="alert">Previsão de caixa negativo a partir de {negative?displayDate(negative.date):'data não determinada'}, em {cash.data.negativeDays} dias do período.</p>}
    <BalanceChart days={cash.data.days}/>
   </Card>
   {cash.data.warnings.length>0&&<Card><h2>Pontos de atenção</h2><ul>{cash.data.warnings.map((item,i)=><li key={i}>{item}</li>)}</ul></Card>}
   <PlannedBankPanel empresaId={Number(selectedEmpresa)} obraId={workId?Number(workId):undefined} works={works.data||[]} onChanged={()=>setReload(v=>v+1)}/>
   <Card><h2>Saldos por conta bancária</h2><div className="bank-card-grid">{cash.data.banks.map(b=><div key={b.id} className="bank-account-card"><BarChart3 size={20}/><strong>{b.nome}</strong><small>{b.bancoNome} · saldo inicial em {displayDate(b.referenceDate)}</small><strong>{b.covered&&b.realizedCents!==null?money(b.realizedCents):'Sem saldo nessa data'}</strong><small>{b.importedMovements} movimentos importados até a referência</small></div>)}</div></Card>
   <Card><h2>Previsão dia a dia</h2><p>Vencimentos anteriores à referência são previstos para o primeiro dia seguinte. Pagamentos já registrados até a referência são descontados das obrigações.</p>
    <div className="bank-table cash-table"><table><thead><tr><th>Data</th><th>Entradas previstas</th><th>Saídas previstas</th><th>{cash.data?.hasBankBalance?'Saldo projetado':'Resultado gerencial projetado'}</th></tr></thead><tbody>{cash.data.days.map(day=><tr key={day.date} className={day.negative?'cash-row-negative':''}><td>{displayDate(day.date)}</td><td>{money(day.projectedInCents)}</td><td>{money(day.projectedOutCents)}</td><td><strong>{money(day.projectedBalanceCents)}</strong></td></tr>)}</tbody></table></div>
   </Card>
   <Card><h2>Movimentação realizada — últimos 30 dias</h2><p>Valores obtidos dos extratos bancários, sem somar novamente os pagamentos registrados nas contas operacionais.</p>
    <div className="bank-table cash-table"><table><thead><tr><th>Data</th><th>Entradas</th><th>Saídas</th><th>Saldo calculado</th></tr></thead><tbody>{cash.data.history.map(day=><tr key={day.date}><td>{displayDate(day.date)}</td><td>{money(day.realizedInCents)}</td><td>{money(day.realizedOutCents)}</td><td>{day.balanceCents===null?(cash.data?.hasBankBalance?'Cobertura parcial':'Não aplicável à obra'):money(day.balanceCents)}</td></tr>)}</tbody></table></div>
   </Card>
  </>}
 </div>
}
