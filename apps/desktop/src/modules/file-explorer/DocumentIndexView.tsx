import { FileText, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Empty, Field, Loading, SearchInput, Status } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import type { ExplorerDocumentIndex } from './types'

export function DocumentIndexView({ rootId, onOpen }: { rootId: string; onOpen: (relativePath: string) => void }) {
  const index = useAsync<ExplorerDocumentIndex>(() => window.fluxoDre.explorador.index(rootId), [rootId])
  const [search, setSearch] = useState('')
  const [employee, setEmployee] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [categoria, setCategoria] = useState('')
  const [status, setStatus] = useState('')
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return (index.data?.items || []).filter((item) => {
      if (employee && String(item.employee?.id || '') !== employee) return false
      if (competencia && item.competencia !== competencia) return false
      if (categoria && item.categoria !== categoria) return false
      if (status && item.status !== status) return false
      if (!query) return true
      return [item.relativePath, item.employee?.nome, item.employee?.cpf, item.categoria, item.competencia].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query))
    })
  }, [index.data, search, employee, competencia, categoria, status])

  if (index.loading) return <Loading label="Organizando documentos..."/>
  if (index.error) return <div className="file-explorer-state file-explorer-error"><strong>Não foi possível montar a visão organizada</strong><p>{index.error.message}</p><Button variant="secondary" onClick={() => index.reload()}>Tentar novamente</Button></div>

  return <div className="document-index-view">
    <div className="document-index-filters">
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar documentos..."/>
      <Field label="Funcionário"><select value={employee} onChange={(event) => setEmployee(event.target.value)}><option value="">Todos</option>{index.data?.facets.employees.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.cpf || `ID ${item.id}`}</option>)}</select></Field>
      <Field label="Competência"><select value={competencia} onChange={(event) => setCompetencia(event.target.value)}><option value="">Todas</option>{index.data?.facets.competencias.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Categoria"><select value={categoria} onChange={(event) => setCategoria(event.target.value)}><option value="">Todas</option>{index.data?.facets.categorias.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{index.data?.facets.statuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Button variant="secondary" icon={<RefreshCw size={14}/>} onClick={() => index.reload()}>Atualizar</Button>
    </div>
    {rows.length ? <div className="document-index-list">{rows.map((item) => <button type="button" className="document-index-row" key={item.relativePath} onClick={() => onOpen(item.relativePath)}>
      <span className="document-index-icon"><FileText size={19}/></span>
      <span className="document-index-main"><strong>{item.relativePath.split('/').pop()}</strong><small>{item.employee ? `${item.employee.nome} · ${item.employee.cpf || `ID ${item.employee.id}`}` : 'Sem funcionário vinculado'} · {item.competencia || 'sem competência'} · {item.categoria || 'sem categoria'}</small></span>
      <Status value={item.status}/>
    </button>)}</div> : <Empty title="Nenhum documento corresponde aos filtros" description="Ajuste os filtros para ampliar a busca."/>}
  </div>
}
