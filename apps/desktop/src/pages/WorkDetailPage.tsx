import { ArrowLeft, CalendarDays, ClipboardList, FileText, ShoppingCart } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Card, Empty, ErrorState, Kpi, Loading, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl } from '../utils/format'

export default function WorkDetailPage() {
  const { id } = useParams()
  const { data, loading, error, reload } = useAsync(() => window.fluxoDre.obras.overview(Number(id)), [id])
  const edition = useAsync(() => window.fluxoDre.product.getEdition(), [])
  if (loading) return <Card><Loading/></Card>
  if (error) return <Card><ErrorState error={error} retry={reload}/></Card>
  if (!data) return <Card><Empty title="Obra nao encontrada"/></Card>
  const empreiteira = edition.data?.edition === 'empreiteira'
  const totalContratado = data.frentes?.reduce((sum: number, item: any) => sum + Number(item.contratado_centavos || 0), 0) || 0
  const totalPago = data.frentes?.reduce((sum: number, item: any) => sum + Number(item.pago_centavos || 0), 0) || 0
  return <>
    <PageHeader title={data.obra.nome} description={`Obra 360: ${data.obra.status_operacional || data.obra.status || 'em acompanhamento'}`} actions={<Link className="button button-secondary" to="/obras"><ArrowLeft size={16}/>Obras</Link>}/>
    <div className="kpi-grid work-overview-kpis"><Kpi label="Orcado" value={brl(data.orcado_centavos)}/><Kpi label="Contratado" value={brl(totalContratado)}/><Kpi label="Pago" value={brl(totalPago)}/><Kpi label={empreiteira ? 'Receita medida' : 'Medido'} value={brl(data.medido_centavos)}/><Kpi label="Pendencias" value={String(data.pendencias?.length || 0)}/></div>
    <Card style={{ marginTop: 16 }}><div className="card-header"><div><h2>Resultado por frente</h2><p>Orcado, comprometido, contratado, pago, medido e saldo de cada especialidade.</p></div><Link to={`/planejamento?obra=${data.obra.id}`}><CalendarDays size={16}/>Planejamento</Link></div>{data.frentes?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Frente</th><th className="number">Orcado</th><th className="number">Comprometido</th><th className="number">Contratado</th><th className="number">Pago</th>{empreiteira && <th className="number">Receita medida</th>}<th className="number">Saldo</th><th>Pend.</th></tr></thead><tbody>{data.frentes.map((item: any) => <tr key={item.id}><td><strong>{item.nome}</strong><Status value={item.status}/></td><td className="number">{brl(item.orcado_centavos)}</td><td className="number">{brl(item.comprometido_centavos)}</td><td className="number">{brl(item.contratado_centavos)}</td><td className="number">{brl(item.pago_centavos)}</td>{empreiteira && <td className="number">{brl(item.medido_centavos)}</td>}<td className="number">{brl(item.orcado_centavos - Math.max(item.comprometido_centavos, item.contratado_centavos))}</td><td>{item.pendencias_abertas || 0}</td></tr>)}</tbody></table></div> : <Empty title="Nenhuma frente cadastrada" description="Cadastre as frentes e classifique orcamento, compras, planejamento e medicoes." action={<Link className="button button-primary" to="/frentes">Gerenciar frentes</Link>}/>}</Card>
    <div className="dashboard-grid" style={{ marginTop: 16 }}>
      <Card><div className="card-header"><h2>Pendencias abertas</h2><Link to={`/tarefas?obra=${data.obra.id}`}><ClipboardList size={16}/>Abrir</Link></div>{data.pendencias?.length ? <div className="stage-list">{data.pendencias.map((item: any) => <div key={item.id}><div><strong>{item.titulo}</strong><span>{item.frente_nome || 'Obra geral'} - {item.responsavel || 'sem responsavel'}</span></div><div><Status value={item.status}/><small>{brDate(item.prazo)}</small></div></div>)}</div> : <Empty title="Sem pendencias abertas" description="Ocorrencias do RDO e tarefas manuais aparecem aqui."/>}</Card>
      <Card><div className="card-header"><h2>Documentos recentes</h2><Link to={`/documentos?obra=${data.obra.id}`}><FileText size={16}/>Central</Link></div>{data.documentos?.length ? <div className="stage-list">{data.documentos.map((item: any) => <div key={item.id}><div><strong>{item.titulo}</strong><span>{item.categoria}</span></div><small>{brDate(item.created_at)}</small></div>)}</div> : <Empty title="Sem documentos" description="Contratos, RDOs, medicoes e notas entram aqui."/>}</Card>
    </div>
    <div className="dashboard-grid" style={{ marginTop: 16 }}>
      <Card><div className="card-header"><h2>Contratos recentes</h2><Link to={`/contratos?obra=${data.obra.id}`}><FileText size={16}/>Contratos</Link></div>{data.contratos?.length ? <div className="stage-list">{data.contratos.map((item: any) => <div key={item.id}><div><strong>{item.numero || item.descricao}</strong><span>{brl(item.valor_centavos)}</span></div><Status value={item.status}/></div>)}</div> : <Empty title="Sem contratos" description="Cadastre contratos e aditivos para acompanhar o contratado."/>}</Card>
      <Card><div className="card-header"><h2>Compras recentes</h2><Link to={`/compras?obra=${data.obra.id}`}><ShoppingCart size={16}/>Compras</Link></div>{data.compras?.length ? <div className="stage-list">{data.compras.map((item: any) => <div key={item.id}><div><strong>{item.descricao}</strong><span>{brl(item.valor_centavos)}</span></div><Status value={item.status}/></div>)}</div> : <Empty title="Sem compras" description="Solicitacoes, pedidos e recebimentos aparecem aqui."/>}</Card>
    </div>
    <Card style={{ marginTop: 16 }}><div className="card-header"><h2>RDOs recentes</h2><Link to={`/rdo?obra=${data.obra.id}`}>Diario de obra</Link></div>{data.rdos?.length ? <div className="stage-list">{data.rdos.map((item: any) => <div key={item.id}><div><strong>{brDate(item.data)}</strong><span>{item.atividades}</span></div><Status value={item.status}/></div>)}</div> : <Empty title="Sem RDO registrado" description="Registre campo, equipe, equipamentos e ocorrencias."/>}</Card>
  </>
}
