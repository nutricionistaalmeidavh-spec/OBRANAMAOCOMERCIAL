import { useLocation } from 'react-router-dom'
import { useWorkContext } from '../hooks/useWorkContext'
import { useAsync } from '../hooks/useAsync'
import { Field } from './ui'
import { canonicalPath, ROUTES } from '../routes/registry'

export function WorkContextBar() {
  const { pathname } = useLocation()
  const route = canonicalPath(pathname)
  const { competencia, empresaId, obraId, update, setCompetencia } = useWorkContext()
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const scoped = [ROUTES.dashboard, ROUTES.dre, ROUTES.finance].includes(route as any)
  if (!scoped && ![ROUTES.rhPayroll,ROUTES.rhTime].includes(route as any)) return null
  return <section className="work-context-bar" aria-label="Contexto de trabalho">
    {scoped && <Field label="Empresa"><select aria-label="Empresa do contexto" value={empresaId} onChange={e => update({empresaId:e.target.value})}><option value="">Todas as empresas</option>{companies.data?.map((item:any) => <option key={item.id} value={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select></Field>}
    {scoped && route !== ROUTES.dashboard && <Field label="Obra"><select aria-label="Obra do contexto" value={obraId} onChange={e => { const obra = works.data?.find((item:any) => String(item.id) === e.target.value); update({obraId:e.target.value, ...(obra ? {empresaId:String(obra.empresa_id)} : {})}) }}><option value="">Todas as obras</option>{works.data?.filter((item:any) => !empresaId || String(item.empresa_id) === empresaId).map((item:any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>}
    <Field label="Competência compartilhada"><input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)}/></Field>
    <small>{scoped ? route === ROUTES.dashboard ? 'Painel consolidado por empresa; inclui todas as obras.' : 'Filtros compartilhados entre Contas e DRE.' : 'A competência acompanha a navegação entre ponto e folha.'}</small>
    {(companies.error || works.error) && scoped && <span role="status">Não foi possível atualizar as opções. <button onClick={() => { void companies.reload(); void works.reload() }}>Tentar novamente</button></span>}
  </section>
}
