import { BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, Eye, File, FileImage, FileText, Folder, FolderOpen, FolderPlus, Link2, Move, Pencil, RefreshCw, ScanLine, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { Button, Confirm, Field, Loading, Modal, SearchInput, Segmented, Status } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { DocumentIndexView } from './DocumentIndexView'
import { DocumentScannerModal } from './DocumentScannerModal'
import type { ExplorerDirectory, ExplorerEntry, ExplorerPreview, FileExplorerProps } from './types'
import './file-explorer.css'

function formatSize(size: number | null) {
  if (size == null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
function formatModified(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date) }
function entryIcon(entry: ExplorerEntry) {
  if (entry.kind === 'folder') return <Folder size={29} strokeWidth={1.65}/>
  if (entry.kind === 'link') return <Link2 size={26} strokeWidth={1.65}/>
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(entry.extension)) return <FileImage size={27} strokeWidth={1.65}/>
  if (/\.(pdf|txt|docx?|xlsx?|csv)$/i.test(entry.extension)) return <FileText size={27} strokeWidth={1.65}/>
  return <File size={27} strokeWidth={1.65}/>
}
function breadcrumbParts(relativePath: string, rootLabel: string) {
  const parts = relativePath.split('/').filter(Boolean)
  return [{ label: rootLabel, relativePath: '' }, ...parts.map((label, index) => ({ label, relativePath: parts.slice(0, index + 1).join('/') }))]
}
function pathStatus(relativePath:string) {
  const normalized = relativePath.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if (/(^|\/)nao assinados(\/|$)/.test(normalized)) return 'nao_assinado'
  if (/(^|\/)assinados(\/|$)/.test(normalized)) return 'assinado'
  return 'geral'
}
type EditState = { kind: 'rename' | 'move'; entry: ExplorerEntry; value: string } | null
type ScannerTarget = { documentId:number; name:string } | null

export function FileExplorer({ rootId, rootLabel = 'Arquivos', initialPath = '', title = 'Explorador de arquivos', description = 'Visualize e organize as pastas físicas gerenciadas pelo sistema sem sair do aplicativo.', emptyTitle = 'Esta pasta está vazia', className = '', documentFeatures = false }: FileExplorerProps) {
  const [relativePath, setRelativePath] = useState(initialPath)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'folders'|'organized'>('folders')
  const [preview, setPreview] = useState<ExplorerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [edit, setEdit] = useState<EditState>(null)
  const [removeEntry, setRemoveEntry] = useState<ExplorerEntry | null>(null)
  const [scannerTarget, setScannerTarget] = useState<ScannerTarget>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const listing = useAsync<ExplorerDirectory>(() => window.fluxoDre.explorador.list(rootId, relativePath), [rootId, relativePath])
  const breadcrumbs = useMemo(() => breadcrumbParts(relativePath, rootLabel), [relativePath, rootLabel])
  const items = useMemo(() => { const query = search.trim().toLocaleLowerCase('pt-BR'); return !query ? listing.data?.items || [] : (listing.data?.items || []).filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query)) }, [listing.data, search])

  const runMutation = async (action: () => Promise<unknown>) => {
    setBusy(true); setOperationError(null)
    try { await action(); await listing.reload(); return true }
    catch (error) { setOperationError(error instanceof Error ? error.message : String(error)); return false }
    finally { setBusy(false) }
  }
  const showPreviewPath = async (targetPath:string) => {
    setPreview(null); setPreviewError(null); setPreviewLoading(true)
    try { setPreview(await window.fluxoDre.explorador.preview(rootId, targetPath)) }
    catch (error) { setPreviewError(error instanceof Error ? error.message : String(error)) }
    finally { setPreviewLoading(false) }
  }
  const openEntry = async (entry: ExplorerEntry) => { if (!entry.canOpen) return; if (entry.kind === 'folder') { setSearch(''); setRelativePath(entry.relativePath); return }; await showPreviewPath(entry.relativePath) }
  const closePreview = () => { setPreview(null); setPreviewError(null); setPreviewLoading(false) }
  const createFolder = async () => { if (!folderName.trim()) return; if (await runMutation(() => window.fluxoDre.explorador.createFolder(rootId, relativePath, folderName))) { setFolderName(''); setNewFolderOpen(false) } }
  const applyEdit = async () => { if (!edit || (edit.kind === 'rename' && !edit.value.trim())) return; const ok = edit.kind === 'rename' ? await runMutation(() => window.fluxoDre.explorador.rename(rootId, edit.entry.relativePath, edit.value)) : await runMutation(() => window.fluxoDre.explorador.move(rootId, edit.entry.relativePath, edit.value)); if (ok) setEdit(null) }
  const removeSelected = async () => { if (!removeEntry) return; const target = removeEntry; setRemoveEntry(null); await runMutation(() => window.fluxoDre.explorador.remove(rootId, target.relativePath, target.kind === 'folder')) }
  const importFromPicker = () => runMutation(() => window.fluxoDre.explorador.pickImport(rootId, relativePath))
  const moveToSigned = async (entry:ExplorerEntry) => { const ok = await runMutation(() => window.fluxoDre.explorador.moveToSigned(rootId, entry.relativePath)); if (ok) closePreview() }
  const startScanner = async (entry:ExplorerEntry) => {
    setBusy(true); setOperationError(null)
    try { const context = await window.fluxoDre.explorador.context(rootId, entry.relativePath); if (!context.documentId) throw new Error('Este arquivo ainda não possui um documento interno vinculado para receber a digitalização.'); setScannerTarget({ documentId: context.documentId, name: entry.name }) }
    catch (error) { setOperationError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const onDrop = async (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); const files = Array.from(event.dataTransfer.files); if (!files.length) return; const sourcePaths = files.map((file) => window.fluxoDre.explorador.pathForFile(file)).filter(Boolean); if (sourcePaths.length) await runMutation(() => window.fluxoDre.explorador.importFiles(rootId, relativePath, sourcePaths)) }

  return <section className={`file-explorer ${className}`.trim()} aria-label={title}>
    <div className="file-explorer-toolbar">
      <div className="file-explorer-heading"><div className="file-explorer-title-line"><strong>{title}</strong><span>Área gerenciada</span></div><p>{description}</p></div>
      <div className="file-explorer-actions">
        {documentFeatures && <Segmented value={view} onChange={(value) => setView(value as 'folders'|'organized')} options={[{value:'folders',label:'Pastas'},{value:'organized',label:'Organizado'}]}/>} 
        {view === 'folders' && <><SearchInput value={search} onChange={setSearch} placeholder="Buscar nesta pasta..."/><Button variant="secondary" icon={<FolderPlus size={15}/>} onClick={() => { setFolderName(''); setNewFolderOpen(true) }}>Nova pasta</Button><Button variant="secondary" icon={<Upload size={15}/>} onClick={importFromPicker} disabled={busy}>Importar</Button><Button variant="secondary" icon={<RefreshCw size={15}/>} onClick={() => listing.reload()}>Atualizar</Button><Button variant="secondary" icon={<FolderOpen size={15}/>} onClick={() => window.fluxoDre.explorador.open(rootId, relativePath)}>Abrir no Windows</Button></>}
      </div>
    </div>
    {operationError && <div className="file-explorer-operation-error"><strong>Não foi possível concluir a operação.</strong><span>{operationError}</span><button onClick={() => setOperationError(null)} type="button">Fechar</button></div>}

    {view === 'organized' && documentFeatures ? <DocumentIndexView rootId={rootId} onOpen={showPreviewPath}/> : <>
      <div className="file-explorer-nav">{relativePath && <button className="file-explorer-back" type="button" onClick={() => { setSearch(''); setRelativePath(listing.data?.parentRelativePath || '') }}><ChevronLeft size={16}/> Voltar</button>}<nav className="file-explorer-breadcrumbs">{breadcrumbs.map((crumb,index) => <span key={`${crumb.relativePath}-${index}`}>{index > 0 && <ChevronRight size={13}/>}<button type="button" onClick={() => { setSearch(''); setRelativePath(crumb.relativePath) }} aria-current={crumb.relativePath === relativePath ? 'page' : undefined}>{crumb.label}</button></span>)}</nav><span className="file-explorer-count">{listing.data?.items.length || 0} itens</span></div>
      <div className={`file-explorer-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={onDrop}>
        {dragging && <div className="file-explorer-drop-overlay"><Upload size={28}/><strong>Solte para importar nesta pasta</strong></div>}
        {listing.loading ? <div className="file-explorer-state"><Loading/></div> : listing.error ? <div className="file-explorer-state file-explorer-error"><strong>Não foi possível abrir esta pasta</strong><p>{listing.error.message}</p><Button variant="secondary" onClick={() => listing.reload()}>Tentar novamente</Button></div> : items.length ? <div className="file-explorer-grid">{items.map((entry) => {
          const signature = entry.kind === 'file' ? pathStatus(entry.relativePath) : 'geral'
          return <article className={`file-explorer-item file-explorer-${entry.kind}`} key={entry.relativePath}>
            <button className="file-explorer-item-main" type="button" onClick={() => openEntry(entry)} disabled={!entry.canOpen}><span className="file-explorer-item-icon">{entryIcon(entry)}</span><span className="file-explorer-item-copy"><strong>{entry.name}</strong><small>{entry.kind === 'folder' ? 'Pasta' : entry.kind === 'link' ? 'Atalho simbólico bloqueado' : [formatSize(entry.size), formatModified(entry.modifiedAt)].filter(Boolean).join(' · ')}</small>{documentFeatures && entry.kind === 'file' && signature !== 'geral' && <Status value={signature}/>}</span>{entry.kind === 'file' && entry.canOpen && <Eye className="file-explorer-external" size={15}/>}</button>
            {entry.canOpen && <div className="file-explorer-item-actions">{entry.kind === 'folder' && <button type="button" title="Abrir no Windows" onClick={() => window.fluxoDre.explorador.open(rootId, entry.relativePath)}><ExternalLink size={13}/></button>}{documentFeatures && entry.kind === 'file' && signature === 'nao_assinado' && <><button type="button" title="Mover para Assinados" onClick={() => moveToSigned(entry)}><BadgeCheck size={13}/></button><button type="button" title="Digitalizar versão assinada" onClick={() => startScanner(entry)}><ScanLine size={13}/></button></>}<button type="button" title="Renomear" onClick={() => setEdit({ kind: 'rename', entry, value: entry.name })}><Pencil size={13}/></button><button type="button" title="Mover" onClick={() => setEdit({ kind: 'move', entry, value: relativePath })}><Move size={13}/></button><button type="button" title="Excluir" className="danger" onClick={() => setRemoveEntry(entry)}><Trash2 size={13}/></button></div>}
          </article>})}</div> : <div className="file-explorer-state"><Folder size={34}/><strong>{search ? 'Nenhum item encontrado' : emptyTitle}</strong><p>{search ? 'Altere a busca para ver outros arquivos desta pasta.' : 'Arraste arquivos para cá, importe pelo botão acima ou crie uma nova pasta.'}</p></div>}
      </div>
    </>}

    <Modal open={previewLoading || !!preview || !!previewError} title={preview?.name || 'Visualizar arquivo'} onClose={closePreview} size="xl">{previewLoading ? <Loading label="Preparando visualização..."/> : previewError ? <div className="file-explorer-preview-state"><strong>Não foi possível visualizar</strong><p>{previewError}</p></div> : preview && <><div className="file-explorer-preview-meta"><div><span>Nome</span><strong>{preview.name}</strong></div><div><span>Tamanho</span><strong>{formatSize(preview.size)}</strong></div><div><span>Tipo</span><strong>{preview.extension || 'arquivo'}</strong></div><div><span>Modificado</span><strong>{formatModified(preview.modifiedAt)}</strong></div><div className="file-explorer-preview-path"><span>Caminho relativo</span><strong>{preview.relativePath}</strong></div></div><div className="file-explorer-preview-stage">{preview.previewKind === 'image' && preview.dataUrl ? <img src={preview.dataUrl} alt={preview.name}/> : preview.previewKind === 'pdf' && preview.dataUrl ? <iframe src={preview.dataUrl} title={`Prévia de ${preview.name}`}/> : <div className="file-explorer-preview-state"><FileText size={36}/><strong>Prévia interna indisponível</strong><p>{preview.previewBlockedReason === 'size' ? 'O arquivo é grande demais para a visualização interna.' : 'Este tipo de arquivo usa o aplicativo padrão do Windows.'}</p></div>}</div><div className="form-actions"><Button variant="secondary" onClick={closePreview}>Fechar</Button><Button icon={<ExternalLink size={15}/>} onClick={() => window.fluxoDre.explorador.open(rootId, preview.relativePath)}>Abrir no Windows</Button></div></>}</Modal>
    <Modal open={newFolderOpen} title="Nova pasta" onClose={() => setNewFolderOpen(false)} size="sm"><div className="modal-body"><Field label="Nome da pasta"><input value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createFolder() }}/></Field></div><div className="form-actions"><Button variant="secondary" onClick={() => setNewFolderOpen(false)}>Cancelar</Button><Button onClick={createFolder} disabled={!folderName.trim() || busy}>Criar pasta</Button></div></Modal>
    <Modal open={!!edit} title={edit?.kind === 'rename' ? 'Renomear item' : 'Mover item'} onClose={() => setEdit(null)} size="sm"><div className="modal-body">{edit?.kind === 'rename' ? <Field label="Novo nome"><input value={edit.value} onChange={(event) => setEdit({ ...edit, value: event.target.value })}/></Field> : <Field label="Pasta de destino" hint="Caminho relativo a Documentos. Vazio = raiz."><input value={edit?.value || ''} onChange={(event) => edit && setEdit({ ...edit, value: event.target.value })}/></Field>}</div><div className="form-actions"><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={applyEdit} disabled={busy || (edit?.kind === 'rename' && !edit.value.trim())}>Confirmar</Button></div></Modal>
    <Confirm open={!!removeEntry} title={`Excluir ${removeEntry?.kind === 'folder' ? 'pasta' : 'arquivo'}`} description={removeEntry?.kind === 'folder' ? `A pasta “${removeEntry.name}” e todo o conteúdo serão excluídos fisicamente.` : `O arquivo “${removeEntry?.name || ''}” será excluído fisicamente.`} danger onCancel={() => setRemoveEntry(null)} onConfirm={removeSelected}/>
    <DocumentScannerModal target={scannerTarget} onClose={() => setScannerTarget(null)} onSaved={() => { void listing.reload() }}/>
  </section>
}
