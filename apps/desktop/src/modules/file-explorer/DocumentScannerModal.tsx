import { Check, FilePlus2, RefreshCw, ScanLine, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Confirm, Loading, Modal, Segmented } from '../../components/ui'

type ScannerTarget = { documentId: number; name: string } | null

export function DocumentScannerModal({ target, onClose, onSaved }: { target: ScannerTarget; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'grayscale'|'color'>('grayscale')
  const [capabilities, setCapabilities] = useState<ScannerCapabilities | null>(null)
  const [session, setSession] = useState<ScannerSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replaceConflict, setReplaceConflict] = useState(false)

  useEffect(() => {
    let active = true
    if (!target) return
    setSession(null); setError(null); setReplaceConflict(false); setMode('grayscale'); setCapabilities(null)
    void window.fluxoDre.scanner.capabilities().then((value) => { if (active) setCapabilities(value) }).catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : String(failure)) })
    return () => { active = false }
  }, [target?.documentId])

  const run = async <T,>(action: () => Promise<T>, onSuccess?: (value:T) => void) => {
    setBusy(true); setError(null)
    try { const value = await action(); onSuccess?.(value); return value }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return null }
    finally { setBusy(false) }
  }

  const start = () => run(() => window.fluxoDre.scanner.start({ mode }), setSession)
  const addPage = () => session && run(() => window.fluxoDre.scanner.addPage({ sessionId: session.sessionId, mode }), setSession)
  const redoPage = (pageIndex:number) => session && run(() => window.fluxoDre.scanner.redoPage({ sessionId: session.sessionId, pageIndex, mode }), setSession)

  const discardAndClose = async () => {
    if (session) await run(() => window.fluxoDre.scanner.discard({ sessionId: session.sessionId }))
    setSession(null); onClose()
  }

  const save = async (replace = false) => {
    if (!session || !target) return
    const result = await run(() => window.fluxoDre.scanner.saveSigned({ sessionId: session.sessionId, documentId: target.documentId, replace }))
    if (!result) return
    if (result.conflict) { setReplaceConflict(true); return }
    setSession(null); setReplaceConflict(false); onSaved(); onClose()
  }

  return <>
    <Modal open={!!target} title={target ? `Digitalizar versão assinada · ${target.name}` : 'Digitalizar'} onClose={discardAndClose} size="xl">
      {!capabilities && !error ? <Loading label="Verificando scanner..."/> : capabilities && <>
        <div className="scanner-modal-toolbar">
          <div><strong>Scanner Windows / WIA</strong><small>{capabilities.available ? 'Scanner detectado · 300 DPI' : capabilities.supported ? 'Nenhum scanner WIA detectado' : 'Disponível somente no Windows'}</small></div>
          <Segmented value={mode} onChange={(value) => setMode(value as 'grayscale'|'color')} options={[{value:'grayscale',label:'Cinza'},{value:'color',label:'Colorido'}]}/>
          {!session ? <Button icon={<ScanLine size={16}/>} onClick={start} disabled={busy || !capabilities.available}>Digitalizar primeira página</Button> : <Button variant="secondary" icon={<FilePlus2 size={16}/>} onClick={addPage} disabled={busy}>Adicionar página</Button>}
        </div>
        {error && <div className="scanner-modal-error">{error}</div>}
        {session?.pages.length ? <div className="scanner-pages">{session.pages.map((page) => <article key={page.index}><img src={page.preview} alt={`Página ${page.index + 1}`}/><div><strong>Página {page.index + 1}</strong><span>{page.mode === 'color' ? 'Colorido' : 'Cinza'}</span><button type="button" onClick={() => redoPage(page.index)} disabled={busy} title="Digitalizar esta página novamente"><RefreshCw size={14}/></button></div></article>)}</div> : <div className="scanner-empty"><ScanLine size={38}/><strong>Coloque o documento assinado no scanner</strong><p>Digitalize uma página por vez. Você poderá revisar todas antes de gerar o PDF final.</p></div>}
        <div className="form-actions"><Button variant="secondary" icon={<Trash2 size={15}/>} onClick={discardAndClose}>Cancelar e descartar</Button><Button icon={<Check size={15}/>} onClick={() => save(false)} disabled={busy || !session?.pages.length}>Salvar em Assinados</Button></div>
      </>}
      {error && !capabilities && <div className="scanner-modal-error scanner-modal-error-large">{error}</div>}
    </Modal>
    <Confirm open={replaceConflict} title="Já existe uma versão assinada" description="Uma versão assinada com este nome já existe. A versão atual será preservada no histórico e a nova digitalização passará a ser a versão principal." onCancel={() => setReplaceConflict(false)} onConfirm={() => { setReplaceConflict(false); void save(true) }}/>
  </>
}
