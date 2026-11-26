import { useEffect, useState } from 'react'
import { Button, Card } from './ui'

type Inbox = Awaited<ReturnType<typeof window.fluxoDre.online.fieldInbox>>
const KIND: Record<string, string> = { attendance: 'Presença', compensation: 'Compensação', issue: 'Pendência' }
const STATUS: Record<string, string> = { present: 'presente', absent: 'falta', compensation: 'folga compensada' }

/**
 * What the field team recorded on the phone, waiting for the office: payroll data
 * (Ponto) only changes after this review. Issues become tasks automatically.
 */
export default function FieldInboxCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Inbox | null>(null)
  const [people, setPeople] = useState<any[]>([])
  const [choice, setChoice] = useState<Record<number, string>>({})
  const [confirm, setConfirm] = useState<number | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const load = async () => {
    if (typeof window.fluxoDre?.online?.fieldInbox !== 'function') return
    try { setData(await window.fluxoDre.online.fieldInbox()) } catch { setData(null) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    if (!data?.items.some(item => item.kind !== 'issue' && !item.funcionarioId) || people.length) return
    window.fluxoDre.funcionarios?.list?.().then((rows: any) => setPeople((rows || []).filter((row: any) => !row.deleted_at))).catch(() => undefined)
  }, [data, people.length])
  const items = data?.items || []
  if (!items.length && !data?.issue) return null
  if (compact) return <Card style={{ marginBottom: 14 }}><div className="card-body" role="status"><strong>{items.length} registro(s) do celular aguardando conferência</strong><p>Presenças, faltas e compensações só entram no ponto depois de conferidas em Pessoas &amp; RH → Folhas de ponto.</p></div></Card>
  const run = async (id: number, overwrite = false) => {
    setBusy(id); setError('')
    try {
      await window.fluxoDre.online.applyFieldInbox(id, choice[id] ? Number(choice[id]) : undefined, overwrite)
      setConfirm(null); await load()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      if (/Confirme para substituir/.test(message)) setConfirm(id)
      setError(message)
    } finally { setBusy(null) }
  }
  const dismiss = async (id: number) => { setBusy(id); try { await window.fluxoDre.online.dismissFieldInbox(id); await load() } finally { setBusy(null) } }
  return <Card style={{ marginBottom: 14 }}>
    <div className="card-body" role="region" aria-label="Registros do celular para conferir">
      <h2 style={{ marginTop: 0 }}>Registrado no celular — conferir</h2>
      <p>Confira antes de lançar: o ponto só é alterado depois do seu clique, e nada já marcado pelo escritório é substituído sem confirmação.</p>
      {data?.issue && <p role="alert" className="error-box">{data.issue.message}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>{items.map(item => <li key={item.id} style={{ marginBottom: 10 }}>
        <strong>{KIND[item.kind]}</strong> · {item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''} · {item.kind === 'issue' ? item.title : `${item.name}: ${STATUS[item.status || ''] || item.status}`}
        {item.message && <div><small>{item.message}</small></div>}
        <div className="row-actions">
          {item.kind !== 'issue' && !item.funcionarioId && <select aria-label="Funcionário correspondente" value={choice[item.id] || ''} onChange={event => setChoice({ ...choice, [item.id]: event.target.value })}><option value="">Escolha o funcionário…</option>{people.map(person => <option key={person.id} value={person.id}>{person.nome}</option>)}</select>}
          <Button variant="secondary" disabled={busy !== null || (item.kind !== 'issue' && !item.funcionarioId && !choice[item.id])} onClick={() => void run(item.id)}>{item.kind === 'issue' ? 'Criar tarefa' : 'Lançar no ponto'}</Button>
          {confirm === item.id && <Button variant="secondary" disabled={busy !== null} onClick={() => void run(item.id, true)}>Substituir marcação</Button>}
          <Button variant="ghost" disabled={busy !== null} onClick={() => void dismiss(item.id)}>Descartar</Button>
        </div>
      </li>)}</ul>
      {error && <p role="alert" className="error-box">{error}</p>}
    </div>
  </Card>
}
