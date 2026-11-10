import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Button } from './ui'

export function DocumentRecoveryNotice({ active, onRecovered }: { active: boolean; onRecovered?: () => void }) {
  const pending = useAsync(() => active ? window.fluxoDre.documentos.pendingFiles() : Promise.resolve([]), [active])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const recover = async () => {
    setBusy(true); setMessage('')
    try {
      const result = await window.fluxoDre.documentos.recoverBackup()
      if (result) {
        setMessage(`${result.restored} arquivo(s) recuperado(s); ${result.pending} pendente(s). ${result.errors.length ? `${result.errors.length} arquivo(s) com erro. ${result.errors[0]}` : 'Arquivos sem correspondência foram ignorados.'}`)
        await pending.reload(); onRecovered?.()
      }
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  if (!active) return null
  if (pending.error) return <div role="alert">Não foi possível consultar documentos pendentes: {pending.error.message} <Button variant="secondary" onClick={() => pending.reload()}>Consultar novamente</Button></div>
  if (!pending.data?.length && !message) return null
  return <div className="success-box" style={{ marginBottom: 14 }} role="status">
    {!!pending.data?.length && <><strong>{pending.data.length} documentos históricos aguardam recuperação.</strong><p>Os registros e vínculos foram preservados. Documentos novos são salvos normalmente no servidor da empresa. Os PDFs ausentes ainda não estão disponíveis.</p><p>Selecione um ZIP com cópias dos arquivos. Apenas conteúdos que correspondem aos documentos pendentes serão recuperados, sem substituir documentos disponíveis.</p><Button variant="secondary" disabled={busy} onClick={recover}>{busy ? 'Conferindo backup…' : 'Recuperar de backup'}</Button></>}
    {message && <p>{message}</p>}
  </div>
}
