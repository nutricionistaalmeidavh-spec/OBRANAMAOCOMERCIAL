import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button, Field, Modal } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

export default function EmployeeBatchDialog({ onClose }: { onClose: () => void }) {
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const api = window.fluxoDre.funcionarios
  const [companyId, setCompanyId] = useState('')
  const [preview, setPreview] = useState<EmployeeBatchPreview | null>(null)
  const [result, setResult] = useState<EmployeeBatchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const rows = result?.rows ?? preview?.rows ?? []
  const ready = preview?.rows.filter(row => !row.errors.length).length ?? 0

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.') }
    finally { setBusy(false) }
  }

  const close = () => { if (!busy) onClose() }

  return <Modal open title="Como gerar relatório para admissão em lote" size="lg" onClose={close}>
    <div className="modal-body">
      <ol>
        <li>Baixe o modelo Excel e preencha uma linha por funcionário.</li>
        <li>Selecione a empresa e anexe a planilha preenchida para revisar as linhas.</li>
        <li>Confirme a criação dos cadastros válidos.</li>
      </ol>
      <div className="toolbar">
        <Button variant="secondary" disabled={busy} icon={<Download size={16}/>} onClick={() => void run(async () => {
          if (await api.downloadAdmissionTemplate()) setMessage('Planilha modelo salva.')
        })}>Baixar planilha modelo</Button>
      </div>
      <div className="toolbar">
        <Field label="Empresa" required>
          <select value={companyId} disabled={busy || companies.loading} onChange={event => {
            setCompanyId(event.target.value)
            setPreview(null)
            setResult(null)
          }}>
            <option value="">Selecione a empresa</option>
            {companies.data?.filter(company => company.status !== 'inativa').map(company =>
              <option key={company.id} value={company.id}>{company.nome_fantasia || company.razao_social}</option>
            )}
          </select>
        </Field>
        <Button variant="secondary" disabled={busy || !companyId} icon={<Upload size={16}/>} onClick={() => void run(async () => {
          setPreview(null)
          setResult(null)
          setPreview(await api.previewAdmissionBatch(Number(companyId)))
        })}>Anexar planilha preenchida</Button>
      </div>
      {companies.error && <div className="notice" role="alert">{companies.error.message}</div>}
      {message && <p role="status">{message}</p>}
      {error && <div className="notice" role="alert">{error}</div>}
      {preview && <p role="status">{preview.filename} · {ready} de {rows.length} linhas prontas para importar</p>}
      {result && <p role="status">{result.created} de {rows.length} cadastros criados.</p>}
      {rows.length > 0 && <div className="table-wrap" style={{ maxHeight: 320 }}>
        <table className="data-table">
          <thead><tr><th>Linha</th><th>Funcionário</th><th>Situação</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.line}>
            <td>{row.line}</td><td>{row.name || '—'}</td>
            <td>{row.errors.length ? row.errors.join(' ') : result ? 'Cadastrado' : 'Pronto para importar'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
    <div className="form-actions">
      <Button variant="secondary" disabled={busy} onClick={close}>Fechar</Button>
      {preview && <Button disabled={busy || !ready} onClick={() => void run(async () => {
        setPreview(null)
        setResult(await api.commitAdmissionBatch(preview.token))
      })}>{busy ? 'Importando…' : `Cadastrar ${ready} ${ready === 1 ? 'funcionário' : 'funcionários'}`}</Button>}
    </div>
  </Modal>
}
