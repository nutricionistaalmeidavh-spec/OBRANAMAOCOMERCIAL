import { useSearchParams, Link } from 'react-router-dom'
import { useWorkContext } from '../hooks/useWorkContext'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Empty, Field, Loading, PageHeader } from '../components/ui'
import OperationalSheetGrid, { type SheetColumn, type SheetRow } from '../components/OperationalSheetGrid'
import { groupStockMovements } from '../utils/operational-sheet'
import ProcurementPage from './ProcurementPage'

type Work = { id: number; nome: string; empresa_id: number }
const columns: SheetColumn[] = [
  {key:'obra_nome',label:'Obra',width:180},
  {key:'descricao',label:'Material',width:210},
  {key:'unidade',label:'Unidade'},
  {key:'etapa_nome',label:'Etapa'},
  {key:'entradas',label:'Entradas'},
  {key:'saidas',label:'Saídas'},
  {key:'saldo',label:'Saldo atual'}
]

function ConsolidatedStock({works,companyId,onOpen}:{works:Work[];companyId:string;onOpen:(work:string)=>void}) {
  const result=useAsync(async()=>{
    const rows:SheetRow[]=[]
    // Bounded concurrency. Aggregate separately per work; never sum quantities of unrelated works/units.
    for(let start=0;start<works.length;start+=4){
      const chunk=await Promise.all(works.slice(start,start+4).map(async work=>{
        const [movements,stages]=await Promise.all([
          window.fluxoDre.compras.estoque.list({obra_id:work.id}),
          window.fluxoDre.frentes.list({obra_id:work.id})
        ])
        return groupStockMovements(movements).map(row=>({...row,id:String(work.id)+':'+row.id,obra_id:work.id,obra_nome:work.nome,etapa_nome:stages.find((stage:any)=>Number(stage.id)===row.frente_id)?.nome||'Obra geral'}))
      }))
      rows.push(...chunk.flat())
    }
    return rows
  },[works.map(w=>w.id).join(',')])
  const storage=useAsync(()=>window.fluxoDre.storage.moduleState('finance'),[])
  const blocked=storage.loading?'Verificando armazenamento...':storage.error||!storage.data||!['local','migration-required'].includes(storage.data.state)?'Importação local indisponível neste modo de armazenamento.':undefined
  if(result.loading)return <Card><Loading label="Carregando saldos das obras..."/></Card>
  if(result.error)return <Card><div className="card-body" role="alert"><p>Não foi possível consultar todos os saldos. Nenhum resultado parcial será apresentado como completo.</p><Button variant="secondary" onClick={()=>void result.reload()}>Tentar novamente</Button></div></Card>
  return <Card><OperationalSheetGrid area="estoque" title="Saldos por obra e etapa" rows={result.data||[]} columns={columns} filename={'estoque-consolidado-'+companyId} importArea="estoque" companyId={Number(companyId)||undefined} disabledReason={blocked} allowTemplate onRowAction={row=>onOpen(String(row.obra_id))} rowActionLabel="Abrir obra"/></Card>
}

export default function StockPage(){
  const [params,setParams]=useSearchParams()
  const context=useWorkContext()
  const works=useAsync(()=>window.fluxoDre.obras.list(),[])
  const companies=useAsync(()=>window.fluxoDre.empresas.list(),[])
  const companyId=params.get('empresa')??context.empresaId
  const selectedWork=params.get('obra')||''
  const available=(works.data||[]).filter((work:any)=>!companyId||String(work.empresa_id)===companyId) as Work[]
  const work=available.find(w=>String(w.id)===selectedWork)
  const change=(company:string,obra:string)=>setParams({...company?{empresa:company}:{empresa:''},...obra?{obra}:{}})
  const pending=works.loading||companies.loading
  const failed=works.error||companies.error
  return <>
    <PageHeader title="Estoque" description="Encontre os materiais importados, consulte os saldos e acompanhe as movimentações." actions={<Link className="button button-secondary" to="/compras">Compras e notas recebidas</Link>}/>
    <Card><div className="card-body">
      <div className="form-grid">
        <Field label="Empresa"><select value={companyId} disabled={pending||!!failed} onChange={e=>change(e.target.value,'')}><option value="">Todas as empresas disponíveis</option>{companies.data?.map((company:any)=><option key={company.id} value={String(company.id)}>{company.nome_fantasia||company.razao_social}</option>)}</select></Field>
        <Field label="Obra"><select value={work?selectedWork:''} disabled={pending||!!failed} onChange={e=>change(companyId,e.target.value)}><option value="">Todas as obras</option>{available.map(w=><option key={w.id} value={String(w.id)}>{w.nome}</option>)}</select></Field>
      </div>
      <p>Selecione uma obra para registrar movimentações ou consulte todas para localizar materiais importados.</p>
    </div></Card>
    {pending?<Loading label="Carregando obras..."/>:failed?<Card><div role="alert" className="card-body">Não foi possível carregar as obras ou empresas. <Button onClick={()=>{void works.reload();void companies.reload()}}>Tentar novamente</Button></div></Card>:selectedWork&&!work?<Card><Empty title="Obra indisponível para esta seleção" description="Escolha outra obra ou consulte todas as obras da empresa." action={<Button onClick={()=>change(companyId,'')}>Ver todas as obras</Button>}/></Card>:work?<ProcurementPage key={String(work.id)} stockOnly initialWork={String(work.id)}/>:!available.length?<Card><Empty title="Nenhuma obra disponível" description="Cadastre uma obra ou escolha outra empresa."/></Card>:<ConsolidatedStock key={companyId+':'+available.map(w=>w.id).join(',')} works={available} companyId={companyId} onOpen={id=>change(companyId,id)}/>}
  </>
}
