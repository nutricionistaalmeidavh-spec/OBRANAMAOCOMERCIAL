import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Field } from './ui'
import type { DesktopSyncState } from '../../../../packages/contracts/src/desktop-sync'

/**
 * One-time, visible confirmation of which local work feeds the phone (Obra360/RDO).
 * The match is never guessed by name: a base with existing data needs the
 * administrator's explicit choice, offered here instead of a hidden settings page.
 */
export default function SyncBindingBanner() {
  const [state, setState] = useState<DesktopSyncState | null>(null)
  const [remote, setRemote] = useState<{ company: string; project: string } | null>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [works, setWorks] = useState<any[]>([])
  const [companyId, setCompanyId] = useState('')
  const [workId, setWorkId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    const online = window.fluxoDre?.online
    if (typeof online?.syncState !== 'function') return
    let active = true
    const apply = (value: DesktopSyncState) => { if (active) setState(value) }
    online.syncState().then(apply).catch(() => undefined)
    const unsubscribe = typeof online.onSyncStateChanged === 'function' ? online.onSyncStateChanged(apply) : () => undefined
    return () => { active = false; unsubscribe() }
  }, [])
  const needsBinding = !!state && !state.configured && state.source !== 'lan-client' && !!state.pauseReason && !done
  useEffect(() => {
    if (!needsBinding || remote) return
    let active = true
    Promise.all([window.fluxoDre.online.session(), window.fluxoDre.empresas.list(), window.fluxoDre.obras.list()]).then(([session, companyRows, workRows]) => {
      if (!active || !session?.authorized || !session.company?.id || !session.project?.id) return
      setRemote({ company: session.company.name || String(session.company.id), project: session.project.name || String(session.project.id) })
      const liveCompanies = (companyRows || []).filter((row: any) => !row.deleted_at)
      const liveWorks = (workRows || []).filter((row: any) => !row.deleted_at)
      setCompanies(liveCompanies); setWorks(liveWorks)
      // Pre-select only when there is a single candidate; the admin still confirms.
      if (liveCompanies.length === 1) setCompanyId(String(liveCompanies[0].id))
      const candidates = liveWorks.filter((row: any) => liveCompanies.length !== 1 || String(row.empresa_id) === String(liveCompanies[0].id))
      if (liveCompanies.length === 1 && candidates.length === 1) setWorkId(String(candidates[0].id))
    }).catch(() => undefined)
    return () => { active = false }
  }, [needsBinding, remote])
  if (!needsBinding || !remote) return null
  const choices = works.filter(work => String(work.empresa_id) === companyId)
  const confirm = async () => {
    setBusy(true); setError('')
    try {
      await window.fluxoDre.online.configureSync({ companyId: Number(companyId), workId: Number(workId) })
      setDone(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <Card className="sync-binding-banner" style={{ marginBottom: 14 }}>
    <div className="card-body" role="region" aria-label="Ligar o celular a esta base">
      <h2 style={{ marginTop: 0 }}>Falta um passo para o celular receber os dados</h2>
      <p>A obra online <strong>{remote.project}</strong> ({remote.company}) ainda não está ligada a uma obra deste computador. Escolha a obra correspondente uma única vez; depois a sincronização é automática. Nenhum dado local é apagado.</p>
      <div className="form-grid">
        <Field label="Empresa deste computador"><select value={companyId} disabled={busy} onChange={event => { setCompanyId(event.target.value); setWorkId('') }}><option value="">Selecione…</option>{companies.map(item => <option key={item.id} value={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select></Field>
        <Field label="Obra deste computador"><select value={workId} disabled={busy || !companyId} onChange={event => setWorkId(event.target.value)}><option value="">Selecione…</option>{choices.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      </div>
      <div className="row-actions">
        <Button disabled={busy || !companyId || !workId} onClick={() => void confirm()}>{busy ? 'Ligando…' : 'Confirmar e ligar ao celular'}</Button>
        <Link className="button button-secondary" to="/configuracoes/sistema#sync-settings">Ver detalhes</Link>
      </div>
      {error && <p role="alert" className="error-box">{error}</p>}
    </div>
  </Card>
}
