import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  BanknoteArrowDown, BanknoteArrowUp, BriefcaseBusiness, CircleAlert,
  HardHat, Landmark, RefreshCw, Scale,
} from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, ErrorState, Loading } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { brl, competenceLabel, currentCompetence } from '../../utils/format'

const percentage = (value: number, total: number) => total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0

export default function DashboardPage() {
  const [competencia, setCompetencia] = useState(currentCompetence())
  const { data, loading, error, reload } = useAsync(() => window.fluxoDre.relatorios.dashboard({ competencia }), [competencia])

  return <>
    <header className="command-header">
      <div>
        <span className="command-eyebrow">Central financeira</span>
        <h1>Painel de comando</h1>
        <p>Monitoramento operacional do caixa, resultado e execucao das obras.</p>
      </div>
      <div className="command-header-actions">
        {data?.vencidos > 0 && <div className="command-alert"><CircleAlert size={17}/><div><span>Atencao</span><strong>{brl(data.vencidos)} vencidos</strong></div></div>}
        <label className="field command-period"><span>Periodo fiscal</span><input type="month" value={competencia} onChange={(event) => setCompetencia(event.target.value)}/></label>
        <button className="icon-button command-refresh" onClick={reload} title="Atualizar dados" aria-label="Atualizar dados"><RefreshCw size={16}/></button>
      </div>
    </header>

    {loading ? <Card><Loading/></Card> : error ? <Card><ErrorState error={error} retry={reload}/></Card> : data && <>
      <div className="command-kpi-grid">
        <Card className="command-kpi command-kpi-positive"><div className="command-kpi-heading"><BanknoteArrowUp size={17}/><span>Receitas totais</span></div><strong>{brl(data.receitas)}</strong><div className="metric-track"><i style={{width:'100%'}}/></div></Card>
        <Card className="command-kpi command-kpi-negative"><div className="command-kpi-heading"><BanknoteArrowDown size={17}/><span>Despesas totais</span></div><strong>{brl(data.despesas)}</strong><div className="metric-track"><i style={{width:`${percentage(data.despesas, data.receitas)}%`}}/></div></Card>
        <Card className={`command-kpi ${data.resultado >= 0 ? 'command-kpi-primary' : 'command-kpi-negative'}`}><div className="command-kpi-heading"><Scale size={17}/><span>Resultado operacional</span></div><strong>{brl(data.resultado)}</strong><small>Margem {percentage(data.resultado, data.receitas).toFixed(1).replace('.', ',')}%</small></Card>
        <Card className="command-kpi"><div className="command-kpi-heading"><Landmark size={17}/><span>Contas pendentes</span></div><strong>{brl(data.pagar + data.receber)}</strong><small>{brl(data.pagar)} a pagar</small></Card>
        <Card className="command-kpi command-kpi-warning"><div className="command-kpi-heading"><CircleAlert size={17}/><span>Valores vencidos</span></div><strong>{brl(data.vencidos)}</strong><small>{data.vencidos > 0 ? 'Acao necessaria' : 'Sem atrasos no periodo'}</small></Card>
      </div>

      <div className="command-dashboard-grid">
        <Card className="command-panel command-chart-panel">
          <div className="card-header command-card-header"><div><span className="command-eyebrow">Fluxo financeiro</span><h2>Evolucao de receitas e despesas</h2></div><div className="chart-legend"><span className="legend-positive">Receitas</span><span className="legend-negative">Despesas</span><b>{competencia.slice(0,4)}</b></div></div>
          <div className="card-body command-chart-body">{data.trend?.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend.map((row:any) => ({...row, receitas:row.receitas / 100, despesas:row.despesas / 100}))} margin={{top:12,right:14,left:2,bottom:0}}>
            <defs><linearGradient id="command-revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2fc38c" stopOpacity={.2}/><stop offset="95%" stopColor="#2fc38c" stopOpacity={0}/></linearGradient><linearGradient id="command-expense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff6673" stopOpacity={.16}/><stop offset="95%" stopColor="#ff6673" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="#1d2938" strokeDasharray="4 4" vertical={false}/><XAxis dataKey="competencia" tickFormatter={competenceLabel} tick={{fontSize:10,fill:'#8492a6'}} axisLine={false} tickLine={false}/><YAxis tickFormatter={(value:number) => `R$ ${Math.round(value / 1000)}k`} tick={{fontSize:9,fill:'#657489'}} axisLine={false} tickLine={false}/><Tooltip formatter={(value:any) => brl(Number(value || 0) * 100)} labelFormatter={(label:any) => competenceLabel(String(label || ''))} contentStyle={{background:'#162231',border:'1px solid #263446',borderRadius:8,color:'#dce7f4'}}/><Area type="monotone" dataKey="receitas" stroke="#2fc38c" fill="url(#command-revenue)" strokeWidth={2}/><Area type="monotone" dataKey="despesas" stroke="#ff6673" fill="url(#command-expense)" strokeWidth={2}/>
          </AreaChart></ResponsiveContainer> : <Empty title="Sem movimentacao neste periodo" description="Importe a planilha ou registre contas para visualizar a evolucao."/>}</div>
        </Card>

        <Card className="command-panel command-works-panel">
          <div className="card-header command-card-header"><div><span className="command-eyebrow">Operacao</span><h2>Status das obras</h2></div><HardHat size={18}/></div>
          <div className="command-contract-summary"><div><span>Contratos ativos</span><strong>{data.contratos_ativos}</strong></div><div><span>Volume contratado</span><strong>{brl(data.total_contratado)}</strong></div></div>
          <div className="command-progress-block"><div className="progress-label"><span>Execucao medida</span><strong>{percentage(data.total_medido, data.total_orcado).toFixed(1).replace('.', ',')}%</strong></div><div className="progress command-progress"><div style={{width:`${percentage(data.total_medido, data.total_orcado)}%`}}/></div><div className="progress-values"><span>Orcado {brl(data.total_orcado)}</span><span>Medido {brl(data.total_medido)}</span></div></div>
          <div className="command-work-metrics"><div><span>Saldo a medir</span><strong>{brl(data.saldo_medir)}</strong></div><div><span>A receber</span><strong className="amount-positive">{brl(data.receber)}</strong></div></div>
          <div className="command-info"><BriefcaseBusiness size={16}/><span>Os indicadores usam os valores consolidados dos contratos e medicoes cadastrados.</span></div>
        </Card>
      </div>
    </>}
  </>
}
