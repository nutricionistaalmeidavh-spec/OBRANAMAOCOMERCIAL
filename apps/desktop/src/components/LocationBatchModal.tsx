import { useState } from 'react'
import { Button, Modal } from './ui'

const blankRange = (de = 1, ate = 1): LocationBatchRange => ({ de, ate, unidades: 4, padrao: 'numero', prefixo: 'Apto', duplex: false, ambientes: '' })

/**
 * Units in batch, by floor ranges: e.g. 1º–24º with 8 per floor, 25º–26º duplex with 2.
 * Always previews first; existing names are reused, so a range can be run again.
 */
export default function LocationBatchModal({ open, workId, onClose, onDone }: { open: boolean; workId: string; onClose: () => void; onDone: () => void }) {
  const [ranges, setRanges] = useState<LocationBatchRange[]>([blankRange(1, 1)])
  const [createFloors, setCreateFloors] = useState(true)
  const [preview, setPreview] = useState<LocationBatchResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const spec = (): LocationBatchSpec => ({ criarPavimentos: createFloors, faixas: ranges.map((range) => ({ ...range, de: Number(range.de), ate: Number(range.ate), unidades: Number(range.unidades) })) })
  const change = (index: number, patch: Partial<LocationBatchRange>) => { setPreview(null); setRanges(ranges.map((range, i) => i === index ? { ...range, ...patch } : range)) }
  const example = (range: LocationBatchRange) => {
    const n = Number(range.de) || 0, code = range.padrao === 'letra' ? `${n}A` : `${n}01`
    return `${range.prefixo || 'Apto'} ${code}${range.duplex ? ` (+ piso superior no ${n + 1}º)` : ''}`
  }
  async function run(dryRun: boolean) {
    setError(''); setBusy(true)
    try {
      const result = await window.fluxoDre.locais.batch(Number(workId), spec(), dryRun)
      if (dryRun) setPreview(result)
      else { onDone(); onClose(); setPreview(null) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível gerar os locais.') }
    finally { setBusy(false) }
  }

  return <Modal open={open} title="Gerar unidades em lote" size="xl" onClose={onClose}>
    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Cada linha é uma faixa de pavimentos. Exemplo: 1º ao 24º com 8 apartamentos por andar; 25º e 26º duplex com 2. O que já existir com o mesmo nome no mesmo lugar é mantido.</p>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Do pav.</th><th>Até</th><th>Unid./andar</th><th>Nome</th><th>Numeração</th><th>Duplex</th><th>Ambientes de cada unidade (opcional)</th><th>Exemplo</th><th/></tr></thead><tbody>
        {ranges.map((range, index) => <tr key={index}>
          <td><input aria-label="Do pavimento" type="number" min={-20} max={400} value={range.de} onChange={(e) => change(index, { de: Number(e.target.value) })} style={{ width: 70 }}/></td>
          <td><input aria-label="Até o pavimento" type="number" min={-20} max={400} value={range.ate} onChange={(e) => change(index, { ate: Number(e.target.value) })} style={{ width: 70 }}/></td>
          <td><input aria-label="Unidades por andar" type="number" min={1} max={99} value={range.unidades} onChange={(e) => change(index, { unidades: Number(e.target.value) })} style={{ width: 70 }}/></td>
          <td><input aria-label="Nome da unidade" value={range.prefixo} onChange={(e) => change(index, { prefixo: e.target.value })} style={{ width: 90 }} placeholder="Apto"/></td>
          <td><select aria-label="Numeração" value={range.padrao} onChange={(e) => change(index, { padrao: e.target.value as 'numero' | 'letra' })}><option value="numero">101, 102…</option><option value="letra">1A, 1B…</option></select></td>
          <td style={{ textAlign: 'center' }}><input aria-label="Duplex" type="checkbox" checked={range.duplex} onChange={(e) => change(index, { duplex: e.target.checked })}/></td>
          <td><input aria-label="Ambientes" value={range.ambientes} onChange={(e) => change(index, { ambientes: e.target.value })} placeholder="Sala, Cozinha, Banho" style={{ width: 200 }}/></td>
          <td><small className="muted">{example(range)}</small></td>
          <td><Button variant="ghost" type="button" disabled={ranges.length === 1} onClick={() => { setPreview(null); setRanges(ranges.filter((_, i) => i !== index)) }}>Remover</Button></td>
        </tr>)}
      </tbody></table></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="secondary" type="button" onClick={() => { const last = ranges[ranges.length - 1]; setPreview(null); setRanges([...ranges, blankRange(Number(last?.ate || 0) + 1, Number(last?.ate || 0) + 1)]) }}>+ Faixa</Button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={createFloors} onChange={(e) => { setPreview(null); setCreateFloors(e.target.checked) }}/>Criar os pavimentos que faltarem</label>
      </div>
      {preview && <div className="success-box">
        <strong>Prévia: {preview.total} locais novos</strong> — {preview.floors} pavimentos, {preview.units} unidades{preview.upper ? `, ${preview.upper} pisos superiores` : ''}{preview.rooms ? `, ${preview.rooms} ambientes` : ''}{preview.existing ? ` · ${preview.existing} já existem e serão mantidos` : ''}.
        {preview.missingFloors.length > 0 && <div>Pavimentos que não existem e não serão criados: {preview.missingFloors.join(', ')}.</div>}
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 4 }}>{preview.sample.slice(0, 12).map((row) => <small key={row.floor}>{row.floor}: {row.first} … {row.last}{row.duplex ? ' (duplex)' : ''}</small>)}</div>
      </div>}
      {error && <p role="alert" style={{ color: '#b42318', margin: 0 }}>{error}</p>}
    </div>
    <div className="form-actions">
      <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
      <Button variant="secondary" type="button" disabled={busy} onClick={() => run(true)}>Ver prévia</Button>
      <Button type="button" disabled={busy || !preview || !preview.total} onClick={() => run(false)}>Criar {preview?.total || ''} locais</Button>
    </div>
  </Modal>
}
