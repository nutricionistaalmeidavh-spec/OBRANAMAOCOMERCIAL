import { useEffect, useState } from 'react'
import { Button, Card, Field } from './ui'

type Listing = Awaited<ReturnType<typeof window.fluxoDre.online.syncProjects>>

/**
 * Multiobra: every local work can feed the phone. New works are published
 * automatically; works that already existed are published here, once, by the office.
 */
export default function SyncProjectsCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Listing | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState<Record<number, string>>({})
  const load = async () => {
    if (typeof window.fluxoDre?.online?.syncProjects !== 'function') return
    try { setData(await window.fluxoDre.online.syncProjects()) } catch { setData(null) }
  }
  useEffect(() => { void load() }, [])
  if (!data?.configured) return null
  const unbound = data.localWorks.filter(work => !work.bound)
  const freeOnline = data.projects.filter(project => project.localWorkId == null)
  if (compact && !unbound.length) return null
  const atLimit = !!data.limits && data.limits.used >= data.limits.maxProjects
  const publish = async (workId: number) => {
    setBusy(workId); setError(''); setNotice('')
    try {
      const result = await window.fluxoDre.online.addSyncProject(workId, target[workId] || undefined)
      setNotice(`${result.name} passa a aparecer no celular. A primeira sincronização começa agora.`)
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(null) }
  }
  return <Card style={{ marginBottom: 14 }}>
    <div className="card-body" role="region" aria-label="Obras no celular">
      <h2 style={{ marginTop: 0 }}>Obras no celular</h2>
      <p>{unbound.length ? `${unbound.length} obra(s) deste computador ainda não aparecem no celular. Obras novas são publicadas automaticamente.` : 'Todas as obras deste computador já aparecem no celular.'}{data.limits ? ` Licença: ${data.limits.used} de ${data.limits.maxProjects} obra(s) online.` : ''}</p>
      {unbound.map(work => <div className="row-actions" key={work.id}>
        <strong style={{ minWidth: 180 }}>{work.nome}</strong>
        {freeOnline.length > 0 && <Field label="Destino"><select value={target[work.id] || ''} disabled={busy !== null} onChange={event => setTarget({ ...target, [work.id]: event.target.value })}><option value="">Criar obra online com este nome</option>{freeOnline.map(project => <option key={project.id} value={project.id}>Usar obra online existente: {project.name}</option>)}</select></Field>}
        <Button variant="secondary" disabled={busy !== null || (atLimit && !target[work.id])} onClick={() => void publish(work.id)}>{busy === work.id ? 'Publicando…' : 'Publicar no celular'}</Button>
      </div>)}
      {atLimit && <p role="status">O limite de obras online da licença foi atingido. Use uma obra online existente ou fale com o suporte para ampliar.</p>}
      {error && <p role="alert" className="error-box">{error}</p>}
      {notice && <p role="status" className="success-box">{notice}</p>}
    </div>
  </Card>
}
