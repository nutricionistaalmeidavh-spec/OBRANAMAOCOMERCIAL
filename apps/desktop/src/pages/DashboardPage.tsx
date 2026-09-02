import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BanknoteArrowDown, BanknoteArrowUp, BriefcaseBusiness, CircleAlert, Landmark, Scale } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, ErrorState, Field, Kpi, Loading, PageHeader } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brl, competenceLabel, currentCompetence } from '../utils/format'

export default function DashboardPage() {
  const [competencia, setCompetencia] = useState(currentCompetence())
  const { data, loading, error, reload } = useAsync(() => window.fluxoDre.relatorios.dashboard({ competencia }), [competencia])
  return <>
    <PageHeader title="Painel geral" description="Uma visão objetiva da operação, do caixa e das obras." actions={<Field label="Competência"><input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}/></Field>}/>
    {loading ? <Card><Loading/></Card> : error ? <Card><ErrorState error={error} retry={reload}/></Card> : data && <>
      <div className="kpi-grid">
        <Kpi label="Receitas" value={brl(data.receitas)} tone="positive" icon={<BanknoteArrowUp size={18}/>}/>
        <Kpi label="Despesas" value={brl(data.despesas)} tone="negative" icon={<BanknoteArrowDown size={18}/>}/>
        <Kpi label="Resultado operacional" value={brl(data.resultado)} tone={data.resultado >= 0 ? 'positive' : 'negative'} icon={<Scale size={18}/>}/>
        <Kpi label="Contas pendentes" value={brl(data.pagar + data.receber)} hint={`${brl(data.pagar)} a pagar`} icon={<Landmark size={18}/>}/>
        <Kpi label="Valores vencidos" value={brl(data.vencidos)} tone={data.vencidos ? 'warning' : 'default'} icon={<CircleAlert size={18}/>}/>
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="card-header"><h2>Receitas versus despesas</h2><span className="status status-neutral">{competencia.slice(0,4)}</span></div>
          <div className="card-body" style={{height:290}}>{data.trend?.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend.map((r:any)=>({...r, receitas:r.receitas/100, despesas:r.despesas/100}))} margin={{top:8,right:10,left:0,bottom:0}}><defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#159a76" stopOpacity={.22}/><stop offset="95%" stopColor="#159a76" stopOpacity={0}/></linearGradient><linearGradient id="exp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#df4545" stopOpacity={.18}/><stop offset="95%" stopColor="#df4545" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8edf3" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="competencia" tickFormatter={competenceLabel} tick={{fontSize:10,fill:'#7c8798'}} axisLine={false} tickLine={false}/><YAxis tickFormatter={(value:number)=>`R$ ${Math.round(value/1000)}k`} tick={{fontSize:9,fill:'#8a95a6'}} axisLine={false} tickLine={false}/><Tooltip formatter={(value:any)=>brl(Number(value || 0)*100)} labelFormatter={(label:any)=>competenceLabel(String(label || ''))}/><Area type="monotone" dataKey="receitas" stroke="#159a76" fill="url(#rev)" strokeWidth={2}/><Area type="monotone" dataKey="despesas" stroke="#df4545" fill="url(#exp)" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <Empty title="Sem movimentação neste período" description="Importe a planilha ou registre contas para visualizar a evolução."/>}</div>
        </Card>
        <Card>
          <div className="card-header"><h2>Resumo das obras</h2><BriefcaseBusiness size={17} color="#7a8596"/></div>
          <div className="summary-strip" style={{gridTemplateColumns:'1fr 1fr'}}><div><span>Contratos ativos</span><strong>{data.contratos_ativos}</strong></div><div><span>Valor contratado</span><strong>{brl(data.total_contratado)}</strong></div></div>
          <div className="card-body"><div className="work-metrics"><div><span>Total orçado</span><strong>{brl(data.total_orcado)}</strong></div><div><span>Total medido</span><strong>{brl(data.total_medido)}</strong></div><div><span>Saldo a medir</span><strong>{brl(data.saldo_medir)}</strong></div><div><span>A receber</span><strong>{brl(data.receber)}</strong></div></div></div>
        </Card>
      </div>
    </>}
  </>
}
