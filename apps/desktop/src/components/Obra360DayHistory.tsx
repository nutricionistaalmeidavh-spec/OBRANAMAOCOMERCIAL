import { useAsync } from '../hooks/useAsync'

/** What the field (Obra360) and the office recorded on this work and date, shown in the RDO. */
export default function Obra360DayHistory({ workId, date }: { workId: string | number; date: string }) {
  const valid = !!workId && /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
  const rows = useAsync(() => valid ? window.fluxoDre.online.obra360History({ workId: Number(workId), date, limit: 100 }).catch(() => []) : Promise.resolve([]), [workId, date, valid])
  if (!valid || !(rows.data || []).length) return null
  return <div className="notice" style={{ marginBottom: 12 }}>
    <strong>Registrado no Obra360 neste dia</strong>
    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{(rows.data || []).map((h: Obra360HistoryEntry) => <li key={h.id}>{h.time ? `${h.time} · ` : ''}{h.label}{h.origin === 'escritorio' ? '' : ' (celular)'}</li>)}</ul>
  </div>
}
