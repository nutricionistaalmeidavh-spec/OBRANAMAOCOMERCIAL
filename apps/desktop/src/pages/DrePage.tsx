import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, Empty, ErrorState, Field, Kpi, Loading, PageHeader, Segmented } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brl, competenceLabel, currentCompetence } from '../utils/format'

export default function DrePage() {
  const [mode, setMode] = useState('mensal')
  const [competencia, setCompetencia] = useState(currentCompetence())
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const { data = [], loading, error, reload } = useAsync(() => window.fluxoDre.relatorios.dre(mode === 'mensal' ? { competencia } : { ano }), [mode, competencia, ano])
  const totals = useMemo(() => (data || []).reduce((acc:any,row:any)=>{acc[row.tipo]=(acc[row.tipo]||0)+row.valor;return acc},{pagar:0,receber:0}), [data])
  const exportCsv = () => {
    const csv = ['Competência;Tipo;Grupo;Categoria;Valor', ...(data||[]).map((r:any)=>`${r.competencia};${r.tipo};${r.grupo};${r.categoria};${(r.valor/100).toFixed(2).replace('.',',')}`)].join('\n')
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`DRE-${mode==='mensal'?competencia:ano}.csv`;a.click();URL.revokeObjectURL(a.href)
  }
  return <>
    <PageHeader title="DRE" description="Demonstrativo do resultado por competência, empresa e obra." actions={<button className="button button-secondary" onClick={exportCsv}><Download size={16}/>Exportar CSV</button>}/>
    <div className="filters"><Segmented value={mode} onChange={setMode} options={[{value:'mensal',label:'Mensal'},{value:'anual',label:'Anual'}]}/>{mode==='mensal'?<Field label="Competência"><input type="month" value={competencia} onChange={(e)=>setCompetencia(e.target.value)}/></Field>:<Field label="Ano"><input type="number" min="2020" max="2100" value={ano} onChange={(e)=>setAno(e.target.value)}/></Field>}</div>
    {loading ? <Card><Loading/></Card> : error ? <Card><ErrorState error={error} retry={reload}/></Card> : <>
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}><Kpi label="Receitas operacionais" value={brl(totals.receber)} tone="positive" icon={<TrendingUp size={18}/>}/><Kpi label="Despesas operacionais" value={brl(totals.pagar)} tone="negative" icon={<TrendingDown size={18}/>}/><Kpi label="Resultado" value={brl(totals.receber-totals.pagar)} tone={totals.receber-totals.pagar>=0?'positive':'negative'}/></div>
      <Card><div className="card-header"><h2>Demonstrativo do resultado — {mode==='mensal'?competenceLabel(competencia):ano}</h2></div>{data?.length ? <div>{['receber','pagar'].map((type)=><div key={type}><div className="dre-row"><strong>{type==='receber'?'Receitas':'Despesas operacionais'}</strong><strong className={type==='receber'?'amount-positive':'amount-negative'}>{brl(totals[type])}</strong></div>{data.filter((r:any)=>r.tipo===type).map((row:any,i:number)=><div className="dre-row" key={`${row.categoria}-${i}`}><span>{row.categoria}<small style={{display:'block',color:'#8a95a6'}}>{mode==='anual'?competenceLabel(row.competencia):row.grupo.replaceAll('_',' ')}</small></span><span style={{textAlign:'right'}}>{brl(row.valor)}</span></div>)}</div>)}<div className="dre-row dre-result"><strong>RESULTADO OPERACIONAL (Receitas − Despesas)</strong><strong className={totals.receber-totals.pagar>=0?'amount-positive':'amount-negative'}>{brl(totals.receber-totals.pagar)}</strong></div></div> : <Empty title="Nenhum lançamento para o período" description="A DRE será preenchida pelas contas e pela importação da planilha 2026."/>}</Card>
    </>}
  </>
}
