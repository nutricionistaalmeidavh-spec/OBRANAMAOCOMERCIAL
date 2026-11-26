import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes/registry'
import { Button, Card, Empty, Loading } from './ui'
import { useAsync } from '../hooks/useAsync'

const STATUS: Array<[Obra360Progress['status'], string]> = [
  ['not_started', 'Não iniciado'], ['released', 'Liberado'], ['in_progress', 'Em execução'], ['completed', 'Concluído'], ['blocked', 'Bloqueado'],
]
const when = (iso: string) => iso.startsWith('1970') ? 'importado do celular' : new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Andamento oficial de cada subetapa em cada pavimento, com o checklist. O que o celular
 * registra chega pela sincronização; o que o escritório altera aqui é publicado de volta.
 */
export default function Obra360ProgressCard({ workId, disabled }: { workId: string; disabled?: boolean }) {
  const [level, setLevel] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const floors = useAsync(() => workId && !disabled ? window.fluxoDre.locais.list({ obra_id: Number(workId) }) : Promise.resolve([]), [workId, disabled])
  const stages = useAsync(() => workId && !disabled ? window.fluxoDre.etapas.list({ obra_id: Number(workId) }) : Promise.resolve([]), [workId, disabled])
  const progress = useAsync(() => workId && !disabled ? window.fluxoDre.online.obra360Progress(Number(workId)).catch(() => null) : Promise.resolve([]), [workId, disabled])
  const levels = useMemo(() => (floors.data || []).filter((f: any) => f.nivel !== null && f.nivel !== undefined).sort((a: any, b: any) => a.nivel - b.nivel), [floors.data])
  const current = level ?? (levels[0] ? Number(levels[0].nivel) : null)
  const history = useAsync(() => workId && !disabled && current !== null ? window.fluxoDre.online.obra360History({ workId: Number(workId), nivel: current, limit: 30 }).catch(() => []) : Promise.resolve([]), [workId, disabled, current, progress.data])
  const byKey = useMemo(() => new Map((progress.data || []).map((p: Obra360Progress) => [`${p.nivel}|${p.service}`, p])), [progress.data])

  async function save(stageId: number, status: Obra360Progress['status'], checklist: Obra360Progress['checklist']) {
    if (current === null) return
    setError(''); setBusy(String(stageId))
    try { await window.fluxoDre.online.saveObra360Progress({ workId: Number(workId), nivel: current, service: `etapa:${stageId}`, status, checklist }); progress.reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o andamento.') }
    finally { setBusy('') }
  }

  if (!workId || disabled) return null
  const offline = progress.data === null
  return <Card style={{ marginTop: 16 }}>
    <div className="card-header"><div><h2>Andamento por pavimento</h2><span>Situação oficial de cada subetapa. O celular envia o que registra; o que você altera aqui vai para o celular.</span></div></div>
    {floors.loading || stages.loading || progress.loading ? <Loading/> : offline ? <Empty title="Obra sem sincronização com o celular" description="Ligue esta obra ao Obra360 (Configurações › Online) para acompanhar o andamento do campo."/> : !levels.length ? <Empty title="Cadastre os pavimentos" description="O andamento é registrado por pavimento. Cadastre-os no card Pavimentos acima."/> : !(stages.data || []).length ? <Empty title="Sem subetapas" description="Cadastre as subetapas da obra para acompanhar o andamento."/> : <>
      <div className="chip-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {levels.map((f: any) => <Button key={f.id} variant={Number(f.nivel) === current ? 'primary' : 'secondary'} onClick={() => setLevel(Number(f.nivel))}>{f.nome}</Button>)}
      </div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Subetapa</th><th>Situação</th><th>Checklist</th><th>Última alteração</th></tr></thead><tbody>
        {(stages.data || []).map((stage: any) => {
          const p = byKey.get(`${current}|etapa:${stage.id}`) as Obra360Progress | undefined
          const status = p?.status || 'not_started', checklist = p?.checklist || []
          return <tr key={stage.id}><td><strong>{stage.nome}</strong></td>
            <td><select aria-label={`Situação de ${stage.nome}`} value={status} disabled={busy === String(stage.id)} onChange={(e) => save(stage.id, e.target.value as Obra360Progress['status'], checklist)}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
            <td>{checklist.length ? checklist.map((item, index) => <label key={item.id + index} style={{ display: 'block' }}><input type="checkbox" checked={item.checked} disabled={busy === String(stage.id)} onChange={(e) => save(stage.id, status, checklist.map((c, i) => i === index ? { ...c, checked: e.target.checked } : c))}/> {item.label}{item.required ? ' *' : ''}</label>) : <span className="muted">—</span>}</td>
            <td>{p ? `${p.origin === 'escritorio' ? 'Escritório' : 'Celular'} · ${when(p.updatedAt)}` : <span className="muted">Sem registro</span>}</td></tr>
        })}
      </tbody></table></div>
      <h3 style={{ marginTop: 16 }}>Histórico do pavimento</h3>
      {(history.data || []).length ? <ul style={{ paddingLeft: 18 }}>{(history.data || []).map((h: Obra360HistoryEntry) => <li key={h.id}>{h.date.split('-').reverse().join('/')}{h.time ? ` ${h.time}` : ''} · {h.label}{h.origin === 'campo' ? ' (celular)' : ''}{h.rdoId ? <> · <Link to={`${ROUTES.dailyReport}?obra=${workId}`}>ver RDO do dia</Link></> : ''}</li>)}</ul> : <p className="muted">Nenhum registro neste pavimento ainda.</p>}
    </>}
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
  </Card>
}
