import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card, Empty, ErrorState, Field, Loading, Segmented } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { brl, competenceLabel, currentCompetence } from '../../utils/format'

export default function DrePage() {
  const [mode, setMode] = useState('mensal')
  const [competencia, setCompetencia] = useState(currentCompetence())
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const { data = [], loading, error, reload } = useAsync(() => window.fluxoDre.relatorios.dre(mode === 'mensal' ? { competencia } : { ano }), [mode, competencia, ano])
  const totals = useMemo(() => (data || []).reduce((acc:any, row:any) => { acc[row.tipo] = (acc[row.tipo] || 0) + row.valor; return acc }, {pagar:0, receber:0}), [data])
  const result = totals.receber - totals.pagar

  const exportCsv = () => {
    const csv = ['Competencia;Tipo;Grupo;Categoria;Valor', ...(data || []).map((row:any) => `${row.competencia};${row.tipo};${row.grupo};${row.categoria};${(row.valor / 100).toFixed(2).replace('.', ',')}`)].join('\n')
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
      <div className="command-kpi-grid command-kpi-grid-three"><Card className="command-kpi command-kpi-positive"><div className="command-kpi-heading"><TrendingUp size={17}/><span>Receitas operacionais</span></div><strong>{brl(totals.receber)}</strong></Card><Card className="command-kpi command-kpi-negative"><div className="command-kpi-heading"><TrendingDown size={17}/><span>Despesas operacionais</span></div><strong>{brl(totals.pagar)}</strong></Card><Card className={`command-kpi ${result >= 0 ? 'command-kpi-primary' : 'command-kpi-negative'}`}><div className="command-kpi-heading"><span>Resultado operacional</span></div><strong>{brl(result)}</strong></Card></div>
      <Card className="command-panel dre-command-panel"><div className="card-header command-card-header"><div><span className="command-eyebrow">Demonstrativo</span><h2>{mode === 'mensal' ? competenceLabel(competencia) : ano}</h2></div><span className={`status ${result >= 0 ? 'status-success' : 'status-danger'}`}>{result >= 0 ? 'Resultado positivo' : 'Resultado negativo'}</span></div>
        {data?.length ? <div className="dre-command-body">{['receber','pagar'].map((type) => <section className={`dre-command-group dre-command-${type}`} key={type}><div className="dre-command-subtotal"><strong>{type === 'receber' ? 'Receitas operacionais' : 'Despesas operacionais'}</strong><strong className={type === 'receber' ? 'amount-positive' : 'amount-negative'}>{brl(totals[type])}</strong></div>{data.filter((row:any) => row.tipo === type).map((row:any, index:number) => <div className="dre-row" key={`${row.categoria}-${index}`}><span><strong>{row.categoria}</strong><small>{mode === 'anual' ? competenceLabel(row.competencia) : row.grupo.replaceAll('_', ' ')}</small></span><span className="number">{brl(row.valor)}</span></div>)}</section>)}<div className={`dre-command-result ${result >= 0 ? 'positive' : 'negative'}`}><span>Resultado operacional</span><strong>{brl(result)}</strong></div></div> : <Empty title="Nenhum lancamento para o periodo" description="A DRE sera preenchida pelas contas e pela importacao da planilha."/>}
      </Card>
    </>}
  </>
}
