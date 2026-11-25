import { useSearchParams, Link } from 'react-router-dom'
import { useWorkContext } from '../hooks/useWorkContext'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Empty, Field, Loading, PageHeader } from '../components/ui'
import StockWorkspace from '../components/StockWorkspace'
import MaterialCatalogPanel from '../components/MaterialCatalogPanel'
import NfePreviewSection from '../components/NfePreviewSection'
import { useState } from 'react'

type Work = { id: number; nome: string; empresa_id: number }
export default function StockPage(){
  const [params,setParams]=useSearchParams()
  const [section,setSection]=useState<'stock'|'catalog'|'nfe'>(params.get('secao')==='nfe'?'nfe':'stock')
  const [stockRevision,setStockRevision]=useState(0)
  const context=useWorkContext()
  const works=useAsync(()=>window.fluxoDre.obras.list(),[])
  const companies=useAsync(()=>window.fluxoDre.empresas.list(),[])
  const selectedWork=params.get('obra')||''
  const companyId=params.get('empresa')??(selectedWork?String(works.data?.find((w:any)=>String(w.id)===selectedWork)?.empresa_id||''):context.empresaId)
  const available=(works.data||[]).filter((work:any)=>!companyId||String(work.empresa_id)===companyId) as Work[]
  const work=available.find(w=>String(w.id)===selectedWork)
  const change=(company:string,obra:string)=>setParams({empresa:company,...(obra?{obra}:{})})
  const pending=works.loading||companies.loading
  const failed=works.error||companies.error
  return <>
    <PageHeader title="Estoque" description="Consulte saldos por obra, importe a nota fiscal (XML) e acompanhe as movimentações." actions={<Link className="button button-secondary" to={work?"/compras?obra="+encodeURIComponent(selectedWork):"/compras"}>Compras e notas recebidas</Link>}/>
    <Card><div className="card-body">
      <div className="form-grid">
        <Field label="Empresa"><select value={companyId} disabled={pending||!!failed} onChange={e=>change(e.target.value,'')}><option value="">Todas as empresas disponíveis</option>{companies.data?.map((company:any)=><option key={company.id} value={String(company.id)}>{company.nome_fantasia||company.razao_social}</option>)}</select></Field>
        <Field label="Obra"><select value={work?selectedWork:''} disabled={pending||!!failed} onChange={e=>change(companyId,e.target.value)}><option value="">Todas as obras</option>{available.map(w=><option key={w.id} value={String(w.id)}>{w.nome}</option>)}</select></Field>
      </div>
      <p>Selecione uma obra para registrar movimentações ou consulte todas para localizar materiais importados.</p>
    </div></Card>
    <div className="row-actions"><Button variant={section==='stock'?'primary':'secondary'} onClick={()=>setSection('stock')}>Estoque por obra</Button><Button variant={section==='nfe'?'primary':'secondary'} onClick={()=>setSection('nfe')}>Importar nota fiscal (XML)</Button><Button variant={section==='catalog'?'primary':'secondary'} onClick={()=>setSection('catalog')}>Catálogo de materiais</Button></div>
    {section==='nfe'&&(work?<NfePreviewSection key={selectedWork} obraId={Number(selectedWork)} onImported={()=>setStockRevision(v=>v+1)}/>:<Card><Empty title="Escolha a obra que recebeu a nota" description="Selecione a obra acima. Depois da leitura do XML você poderá distribuir os itens entre outras obras, etapas e subetapas antes de confirmar."/></Card>)}
    {section==='catalog'?(companyId?<MaterialCatalogPanel key={companyId} companyId={companyId}/>:<Card><Empty title="Selecione uma empresa" description="O catálogo e as equivalências pertencem à empresa."/></Card>):null}
    {section==='stock'&&(pending?<Loading label="Carregando obras..."/>:failed?<Card><div role="alert" className="card-body">Não foi possível carregar as obras ou empresas. <Button onClick={()=>{void works.reload();void companies.reload()}}>Tentar novamente</Button></div></Card>:selectedWork&&!work?<Card><Empty title="Obra indisponível para esta seleção" description="Escolha outra obra ou consulte todas as obras da empresa." action={<Button onClick={()=>change(companyId,'')}>Ver todas as obras</Button>}/></Card>:!available.length?<Card><Empty title="Nenhuma obra disponível" description="Cadastre uma obra ou escolha outra empresa."/></Card>:<StockWorkspace key={stockRevision} companyId={companyId} workId={work?selectedWork:''}/>)}
  </>
}
