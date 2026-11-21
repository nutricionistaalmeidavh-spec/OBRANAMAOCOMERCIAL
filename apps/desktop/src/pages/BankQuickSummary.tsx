import { Link } from 'react-router-dom'
import { Card, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import './BankAccountsPage.css'

type Company={id:number;nome_fantasia?:string;razao_social?:string}
type CashSummary={realizedCents:number;projectedEndCents:number;asOf:string;hasBankBalance:boolean;actualSource:string;balanceDescription:string}
const brl=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100)
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}

/** Indicador isolado do DRE: saldo bancário não é receita nem resultado operacional. */
export default function BankQuickSummary({empresaId}:{empresaId?:number|string|null}){
 const companies=useAsync<Company[]>(()=>window.fluxoDre.empresas.list(),[])
 const id=empresaId?Number(empresaId):Number(companies.data?.[0]?.id||0)
 const company=companies.data?.find(x=>x.id===id)
 const cash=useAsync<CashSummary|null>(()=>id?window.fluxoDre.bancos.cashFlow({empresaId:id,asOf:today(),horizonDays:30}):Promise.resolve(null),[id])
 if(!id)return null
 return <Card className="bank-quick-summary">
  <div>
   <h2>Posição bancária</h2>
   <p>{company?.nome_fantasia||company?.razao_social||'Empresa '+id} · caixa bancário separado do resultado e DRE</p>
  </div>
  {cash.loading?<Loading label="Consultando saldo bancário..."/>:cash.data?.hasBankBalance?<>
   <div className="bank-quick-metrics">
    <div><small>Saldo até {cash.data.asOf}</small><strong>{brl(cash.data.realizedCents)}</strong><small>{cash.data.actualSource==='manual_balance_and_bank_statements'?'Conferência manual + extratos posteriores':'Saldo inicial + extratos'}</small></div>
    <div><small>Previsão para 30 dias</small><strong>{brl(cash.data.projectedEndCents)}</strong><small>Considera contas previstas, sem lançamento fictício</small></div>
   </div>
  </>:<p className="bank-hint">{cash.error?'Cadastre uma conta bancária e informe um saldo de referência para ativar este resumo.':'Sem saldo disponível para a empresa selecionada.'}</p>}
  <div className="bank-quick-actions"><Link to="/financeiro/bancos">Conferir saldos</Link><Link to="/financeiro/fluxo-caixa">Abrir fluxo de caixa</Link></div>
 </Card>
}
