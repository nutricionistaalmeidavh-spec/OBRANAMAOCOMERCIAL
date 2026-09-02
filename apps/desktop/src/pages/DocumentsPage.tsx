import { Copy, ExternalLink, FilePlus, FolderOpen, LocateFixed, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card, Confirm, Empty, Field, Loading, Modal, PageHeader, SearchInput, Segmented, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate } from '../utils/format'

export default function DocumentsPage() {
  const [tab, setTab] = useState('todos')
  const [search, setSearch] = useState('')
  const [work, setWork] = useState(new URLSearchParams(location.search).get('obra') || '')
  const [front, setFront] = useState('')
  const [upload, setUpload] = useState(false)
  const [mode, setMode] = useState<'funcionario' | 'obra'>('obra')
  const [form, setForm] = useState<any>({ funcionario_id: '', obra_id: work, frente_id: '', categoria: 'documento_obra', status_assinatura: 'geral' })
  const [remove, setRemove] = useState<any>(null)
  const docs = useAsync(() => window.fluxoDre.documentos.list(), [])
  const files = useAsync(() => window.fluxoDre.arquivos.list(), [])
  const employees = useAsync(() => window.fluxoDre.funcionarios.list(), [])
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const rows = useMemo(() => docs.data?.filter((doc: any) => {
    const tabOk = tab === 'todos' || doc.status_assinatura === tab || doc.categoria === tab
    const searchOk = doc.titulo.toLowerCase().includes(search.toLowerCase()) || doc.categoria.toLowerCase().includes(search.toLowerCase())
    const workOk = !work || String(doc.obra_id || '') === work
    const frontOk = !front || String(doc.frente_id || '') === front
    return tabOk && searchOk && workOk && frontOk
  }) || [], [docs.data, tab, search, work, front])
  const getPath = (document: any) => files.data?.find((file: any) => file.id === document.arquivo_id)?.caminho
  const importDoc = async () => {
    const result = mode === 'funcionario'
      ? await window.fluxoDre.documentos.importForEmployee({ ...form, funcionario_id: Number(form.funcionario_id), title: form.categoria })
      : await window.fluxoDre.documentos.importForWork({ ...form, obra_id: Number(form.obra_id), frente_id: form.frente_id ? Number(form.frente_id) : null, title: form.categoria })
    if (result) {
      setUpload(false)
      await Promise.all([docs.reload(), files.reload()])
    }
  }
  return <>
    <PageHeader title="Central de documentos" description="Documentos de obra, RDO, medicoes, contratos, compras e RH em um unico lugar." actions={<><Button variant="secondary" icon={<FolderOpen size={16}/>} onClick={() => window.fluxoDre.documentos.openFolder()}>Abrir pasta</Button><Button icon={<FilePlus size={16}/>} onClick={() => { setForm({ ...form, obra_id: work, frente_id: front }); setUpload(true) }}>Importar documento</Button></>}/>
    <div className="toolbar"><div className="toolbar-left"><Segmented value={tab} onChange={setTab} options={[{ value: 'todos', label: 'Todos' }, { value: 'rdo', label: 'RDO' }, { value: 'medicao', label: 'Medicoes' }, { value: 'contrato', label: 'Contratos' }, { value: 'compra', label: 'Compras' }, { value: 'assinado', label: 'Assinados' }]}/><SearchInput value={search} onChange={setSearch} placeholder="Buscar documentos..."/></div></div>
    <div className="filters"><Field label="Obra"><select value={work} onChange={(event) => { setWork(event.target.value); setFront('') }}><option value="">Todas</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Frente"><select value={front} onChange={(event) => setFront(event.target.value)} disabled={!work}><option value="">Todas</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div>
    <Card>{docs.loading ? <Loading/> : rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Documento</th><th>Obra/Frente</th><th>Colaborador</th><th>Categoria</th><th>Versao</th><th>Status</th><th>Data</th><th></th></tr></thead><tbody>{rows.map((document: any) => { const filePath = getPath(document); return <tr key={document.id}><td><strong>{document.titulo}</strong></td><td>{works.data?.find((item: any) => item.id === document.obra_id)?.nome || '-'}<small>{fronts.data?.find((item: any) => item.id === document.frente_id)?.nome || ''}</small></td><td>{employees.data?.find((employee: any) => employee.id === document.funcionario_id)?.nome || '-'}</td><td>{document.categoria.replaceAll('_', ' ')}</td><td>v{document.versao}</td><td><Status value={document.status_assinatura}/></td><td>{brDate(document.created_at)}</td><td><div className="row-actions">{filePath && <><button className="icon-button" onClick={() => window.fluxoDre.documentos.open(filePath)} title="Abrir"><ExternalLink size={15}/></button><button className="icon-button" onClick={() => window.fluxoDre.documentos.reveal(filePath)} title="Localizar"><LocateFixed size={15}/></button><button className="icon-button" onClick={() => window.fluxoDre.documentos.copyPath(filePath)} title="Copiar caminho"><Copy size={15}/></button></>}<button className="icon-button" onClick={() => setRemove(document)} aria-label="Remover"><Trash2 size={15}/></button></div></td></tr> })}</tbody></table></div> : <Empty title="Nenhum documento encontrado" description="Importe documento de obra ou gere/importe documentos de RH."/>}</Card>
    <Modal open={upload} title="Importar documento" onClose={() => setUpload(false)}><div className="modal-body form-grid"><Field label="Tipo" wide><select value={mode} onChange={(event) => setMode(event.target.value as any)}><option value="obra">Documento de obra</option><option value="funcionario">Documento de funcionario</option></select></Field>{mode === 'obra' ? <><Field label="Obra" required wide><select value={form.obra_id} onChange={(event) => setForm({ ...form, obra_id: event.target.value, frente_id: '' })}><option value="">Selecione</option>{works.data?.map((item: any) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field><Field label="Frente"><select value={form.frente_id} onChange={(event) => setForm({ ...form, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field><Field label="Categoria"><select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>{['documento_obra', 'rdo', 'medicao', 'contrato', 'compra', 'nota_fiscal', 'art_rrt', 'foto', 'outro'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></Field></> : <><Field label="Funcionario" required wide><select value={form.funcionario_id} onChange={(event) => setForm({ ...form, funcionario_id: event.target.value })}><option value="">Selecione</option>{employees.data?.map((employee: any) => <option value={employee.id} key={employee.id}>{employee.nome}</option>)}</select></Field><Field label="Destino"><select value={form.status_assinatura} onChange={(event) => setForm({ ...form, status_assinatura: event.target.value })}><option value="geral">Documentacao Geral</option><option value="assinado">Assinados</option></select></Field><Field label="Categoria"><select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>{['RG', 'CPF', 'CNH', 'Foto 3x4', 'Comprovante de residencia', 'eSocial', 'NR06', 'NR12', 'NR18', 'NR35', 'ASO', 'Outro'].map((item) => <option key={item}>{item}</option>)}</select></Field></>}</div><div className="form-actions"><Button variant="secondary" onClick={() => setUpload(false)}>Cancelar</Button><Button onClick={importDoc} disabled={mode === 'obra' ? !form.obra_id : !form.funcionario_id}>Selecionar e importar</Button></div></Modal>
    <Confirm open={!!remove} title="Remover documento" description="O cadastro sera removido, mas o arquivo fisico sera preservado. A exclusao fisica exige confirmacao separada." danger onCancel={() => setRemove(null)} onConfirm={async () => { await window.fluxoDre.documentos.delete({ id: remove.id, deletePhysical: false }); setRemove(null); docs.reload() }}/>
  </>
}
