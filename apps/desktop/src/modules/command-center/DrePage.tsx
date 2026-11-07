import { useWorkContext } from '../../hooks/useWorkContext'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { Button, Card, Empty, ErrorState, Field, Loading, Segmented } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { brl, competenceLabel } from '../../utils/format'

type DreRow = { competencia:string; tipo:string; categoria:string; grupo?:string; valor:number; valor_realizado?:number }
export function analyzeDre(rows:DreRow[], year:string) {
  const months = Array.from({length:12},(_,index)=>{
    const key=`${year}-${String(index+1).padStart(2,'0')}`
    const items=rows.filter(row=>row.competencia===key)
    const sum=(type:string,realized=false)=>items.filter(row=>row.tipo===type).reduce((total,row)=>total+Number((realized?row.valor_realizado:row.valor)||0),0)
    return {key,items,receitas:sum('receber'),despesas:sum('pagar'),receitasRealizadas:sum('receber',true),despesasRealizadas:sum('pagar',true)}
  })
  const categories = new Map<string,{name:string;competencia:number;realizado:number}>()
  rows.filter(row=>row.tipo==='pagar').forEach(row=>{
    const name=row.categoria||'Sem categoria'
    const entry=categories.get(name)||{name,competencia:0,realizado:0}
    entry.competencia+=Number(row.valor||0);entry.realizado+=Number(row.valor_realizado||0)
    categories.set(name,entry)
  })
  return {months,categories:[...categories.values()]}
}

export default function DrePage() {
  const [mode, setMode] = useState('mensal')
  const [analysisBasis,setAnalysisBasis]=useState('competencia')
  const { competencia, setCompetencia, empresaId, obraId } = useWorkContext()
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const { data = [], loading, error, reload } = useAsync(() => window.fluxoDre.relatorios.dre(mode === 'mensal' ? { competencia, empresa_id:empresaId || undefined, obra_id:obraId || undefined } : { ano, empresa_id:empresaId || undefined, obra_id:obraId || undefined }), [mode, competencia, ano, empresaId, obraId])
  const totals = useMemo(() => (data || []).reduce((acc:any, row:any) => { acc[row.tipo] = (acc[row.tipo] || 0) + Number(row.valor||0); acc[row.tipo+'Realizado'] = (acc[row.tipo+'Realizado'] || 0) + Number(row.valor_realizado||0); return acc }, {pagar:0, receber:0, pagarRealizado:0, receberRealizado:0}), [data])
  const analysis=useMemo(()=>analyzeDre(data||[],mode==='anual'?ano:competencia.slice(0,4)),[data,ano,mode,competencia])
  const expenseCategories=analysis.categories.map(category=>({...category,value:analysisBasis==='realizado'?category.realizado:category.competencia})).sort((a,b)=>b.value-a.value)
  const expenseTotal=expenseCategories.reduce((sum,item)=>sum+item.value,0)
  const evolution=analysis.months.map(month=>({name:competenceLabel(month.key),receitas:analysisBasis==='realizado'?month.receitasRealizadas:month.receitas,despesas:analysisBasis==='realizado'?month.despesasRealizadas:month.despesas}))
  const result = totals.receber - totals.pagar
  const resultRealizado = totals.receberRealizado - totals.pagarRealizado

  const exportCsv = () => {
    const csv = ['Competencia;Tipo;Grupo;Categoria;Competencia;Realizado', ...(data || []).map((row:any) => `${row.competencia};${row.tipo};${row.grupo};${row.categoria};${(Number(row.valor||0) / 100).toFixed(2).replace('.', ',')};${(Number(row.valor_realizado||0) / 100).toFixed(2).replace('.', ',')}`)].join('\n')
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}))
    anchor.download = `DRE-${mode === 'mensal' ? competencia : ano}.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  return <>
    <header className="command-header">
      <div><span className="command-eyebrow">Resultado financeiro</span><h1>Demonstrativo de resultado</h1><p>Receitas, despesas e resultado operacional por competencia.</p></div>
      <div className="command-header-actions"><Button variant="secondary" icon={<Download size={16}/>} onClick={exportCsv}>Exportar CSV</Button></div>
    </header>
    <div className="command-filter-band"><Segmented value={mode} onChange={setMode} options={[{value:'mensal',label:'Mensal'},{value:'anual',label:'Anual'}]}/>{mode === 'mensal' ? <Field label="Competencia"><input type="month" value={competencia} onChange={(event) => setCompetencia(event.target.value)}/></Field> : <Field label="Ano"><input type="number" min="2020" max="2100" value={ano} onChange={(event) => setAno(event.target.value)}/></Field>}</div>
    {loading ? <Card><Loading/></Card> : error ? <Card><ErrorState error={error} retry={reload}/></Card> : <>
      <div className="command-kpi-grid command-kpi-grid-three"><Card className="command-kpi command-kpi-positive"><div className="command-kpi-heading"><TrendingUp size={17}/><span>Receitas operacionais</span></div><strong>{brl(totals.receber)}</strong><small>Realizado {brl(totals.receberRealizado)}</small></Card><Card className="command-kpi command-kpi-negative"><div className="command-kpi-heading"><TrendingDown size={17}/><span>Despesas operacionais</span></div><strong>{brl(totals.pagar)}</strong><small>Realizado {brl(totals.pagarRealizado)}</small></Card><Card className={`command-kpi ${result >= 0 ? 'command-kpi-primary' : 'command-kpi-negative'}`}><div className="command-kpi-heading"><span>Resultado operacional</span></div><strong>{brl(result)}</strong><small>Realizado {brl(resultRealizado)}</small></Card></div>
      <Card className="command-panel dre-command-panel"><div className="card-header command-card-header"><div><span className="command-eyebrow">Demonstrativo</span><h2>{mode === 'mensal' ? competenceLabel(competencia) : ano}</h2></div><span className={`status ${result >= 0 ? 'status-success' : 'status-danger'}`}>{result >= 0 ? 'Resultado positivo' : 'Resultado negativo'}</span></div>
        {data?.length ? mode==='anual'?<div className="dre-annual-wrap"><div className="dre-month-columns"><span>Mês / detalhes</span><span>Receitas</span><span>Despesas</span><span>Resultado</span><span>Resultado realizado</span></div>{analysis.months.map(month=><details className="dre-month" key={month.key}><summary><strong>{competenceLabel(month.key)}</strong><span className="amount-positive">{brl(month.receitas)}</span><span>{brl(month.despesas)}</span><strong className={month.receitas-month.despesas>=0?'amount-positive':'amount-negative'}>{brl(month.receitas-month.despesas)}</strong><span>{brl(month.receitasRealizadas-month.despesasRealizadas)}</span></summary><div className="dre-month-detail"><div className="dre-row dre-row-head"><span>Categoria</span><strong>Competência</strong><strong>Realizado</strong></div>{month.items.length?month.items.map((row,index)=><div className="dre-row" key={index}><span><strong>{row.categoria}</strong><small>{row.tipo==='pagar'?'Despesa':'Receita'} · {(row.grupo||'').replaceAll('_',' ')}</small></span><span className="number">{brl(row.valor)}</span><span className="number">{brl(row.valor_realizado||0)}</span></div>):<p>Sem lançamentos neste mês.</p>}</div></details>)}<div className="dre-month-columns dre-annual-total"><strong>Total do ano</strong><strong>{brl(totals.receber)}</strong><strong>{brl(totals.pagar)}</strong><strong className={result>=0?'amount-positive':'amount-negative'}>{brl(result)}</strong><strong>{brl(resultRealizado)}</strong></div></div>:<div className="dre-command-body"><div className="dre-row dre-row-head"><span></span><strong className="number">Competência</strong><strong className="number">Realizado</strong></div>{['receber','pagar'].map((type) => <section className={`dre-command-group dre-command-${type}`} key={type}><div className="dre-command-subtotal"><strong>{type === 'receber' ? 'Receitas operacionais' : 'Despesas operacionais'}</strong><strong className={type === 'receber' ? 'amount-positive' : 'amount-negative'}>{brl(totals[type])}</strong><strong>{brl(totals[type+'Realizado'])}</strong></div>{data.filter((row:any) => row.tipo === type).map((row:any, index:number) => <div className="dre-row" key={`${row.categoria}-${index}`}><span><strong>{row.categoria}</strong><small>{mode === 'anual' ? competenceLabel(row.competencia) : (row.grupo||'').replaceAll('_', ' ')}</small></span><span className="number">{brl(row.valor)}</span><span className="number">{brl(row.valor_realizado||0)}</span></div>)}</section>)}<div className={`dre-command-result ${result >= 0 ? 'positive' : 'negative'}`}><span>Resultado operacional</span><strong>{brl(result)}</strong><strong>{brl(resultRealizado)}</strong></div></div> : <Empty title="Nenhum lancamento para o periodo" description="A DRE será preenchida pelas contas da competência; o realizado vem das baixas financeiras."/>}
      </Card>
      {!!data?.length&&<section className="dre-insights" aria-label="Análise financeira"><div className="dre-insights-heading"><div><h2>Análise do período</h2><p>{mode==='anual'?ano:competenceLabel(competencia)} · Mesmos filtros do demonstrativo</p></div><Segmented value={analysisBasis} onChange={setAnalysisBasis} options={[{value:'competencia',label:'Competência'},{value:'realizado',label:'Realizado'}]}/></div><div className="dre-insights-grid">
        <Card className="dre-expense-analysis"><h3>Despesas por tipo</h3><p>Participação no total de {brl(expenseTotal)} · {analysisBasis==='realizado'?'valores pagos':'valores da competência'}</p>{expenseCategories.length&&expenseTotal>0?<div className="dre-expense-bars">{expenseCategories.map(item=><div className="dre-expense-item" key={item.name}><div><strong>{item.name}</strong><span>{brl(item.value)} <small>({(item.value/expenseTotal*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%)</small></span></div><div className="dre-expense-track"><span style={{width:`${Math.max(0,Math.min(100,item.value/expenseTotal*100))}%`}}/></div></div>)}</div>:<Empty title="Sem despesas nesta base" description="Altere entre competência e realizado para comparar."/>}</Card>
        <Card className="dre-evolution-analysis"><h3>{mode==='anual'?'Evolução mensal':'Receitas e despesas do mês'}</h3><p>{analysisBasis==='realizado'?'Recebimentos e pagamentos realizados':'Valores por competência'}</p><div className="dre-evolution-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={mode==='anual'?evolution:evolution.filter(item=>item.name===competenceLabel(competencia))} margin={{top:12,right:12,bottom:12,left:12}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:10}} tickFormatter={value=>String(value).split(' de ')[0]}/><YAxis tick={{fontSize:10}} tickFormatter={value=>`${(Number(value)/100000).toLocaleString('pt-BR')} mil`}/><Tooltip formatter={value=>brl(Number(value))}/><Legend/><Bar dataKey="receitas" name="Receitas" fill="#0c929d" radius={[4,4,0,0]}/><Bar dataKey="despesas" name="Despesas" fill="#0b59f5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Card>
      </div></section>}
    </>}
  </>
}
