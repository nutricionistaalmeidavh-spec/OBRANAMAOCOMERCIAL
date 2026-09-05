import { useEffect, useState } from 'react'
import { Button, Card, Confirm, Field } from './ui'
import { useAsync } from '../hooks/useAsync'
import type { DesktopSyncState, LocalConflictResolution } from '../../../../packages/contracts/src/desktop-sync'

export default function SyncSettings() {
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const [state, setState] = useState<DesktopSyncState | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [workId, setWorkId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [remote, setRemote] = useState<{ company: string; project: string } | null>(null)
  const [resolution, setResolution] = useState<{ id: number; choice: LocalConflictResolution } | null>(null)
  const refresh = async () => setState(await window.fluxoDre.online.syncState())
  useEffect(() => {
    let active = true
    const update = () => window.fluxoDre.online.syncState().then(value => { if (active) setState(value) }).catch(reason => { if (active) setError(reason.message) })
    void update()
    const timer = setInterval(update, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (state?.scope) { setCompanyId(String(state.scope.companyId)); setWorkId(String(state.scope.workId)) }
  }, [state?.scope?.companyId, state?.scope?.workId])
  const perform = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(message) } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { try { await refresh() } catch { /* Keep the original operation error. */ } setBusy(false) }
  }
  const prepare = () => perform(async () => {
    const session = await window.fluxoDre.online.session()
    if (!session.authorized || !session.company?.id || !session.project?.id) throw new Error('Vincule primeiro este computador a uma empresa e obra online.')
    setRemote({ company: session.company.name || session.company.id, project: session.project.name || session.project.id }); setConfirmation(true)
  }, '')
  const choices = (works.data || []).filter(work => String(work.empresa_id) === companyId)
  const company = companies.data?.find(item => String(item.id) === companyId)
  const work = choices.find(item => String(item.id) === workId)
  return <Card className="setting-card setting-card-feature" id="sync-settings">
    <h3>Sincronização desktop ↔ online</h3>
    <p>Selecione explicitamente a empresa e a obra locais. Somente esta obra será publicada; dados de outras obras e empresas ficam neste computador.</p>
    <div className="form-grid">
      <Field label="Empresa local"><select value={companyId} disabled={busy} onChange={event => { setCompanyId(event.target.value); setWorkId('') }}><option value="">Selecione...</option>{companies.data?.map(item => <option key={item.id} value={item.id}>{item.razao_social || item.nome_fantasia}</option>)}</select></Field>
      <Field label="Obra local"><select value={workId} disabled={busy || !companyId} onChange={event => setWorkId(event.target.value)}><option value="">Selecione...</option>{choices.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
    </div>
    <div className="setting-actions">
      <Button disabled={busy || !company || !work} onClick={prepare}>Conferir vínculo e ativar</Button>
      <Button variant="secondary" disabled={busy || !state?.configured || state.paused || state.running} onClick={() => perform(() => window.fluxoDre.online.syncNow(), 'Tentativa concluída. Confira as pendências abaixo.')}>Sincronizar agora</Button>
    </div>
    <div role="status" aria-live="polite" style={{ marginTop: 12 }}>
      <strong>{state?.running ? 'Sincronizando...' : state?.paused ? 'Pausada — confira o vínculo' : state?.configured ? 'Sincronização automática ativa' : 'Ainda não configurada'}</strong>
      <p>{state?.pending ?? 0} envio(s) pendente(s) · {state?.conflicts.length ?? 0} conflito(s)</p>
      <small>Última tentativa concluída: {state?.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString('pt-BR') : 'nenhuma'}. Alterações locais são preservadas se a rede falhar.</small>
      {state?.scope && <p>{state.scope.companyName} / {state.scope.workName}<br/><small>Destino: {state.scope.baseUrl} · obra {state.scope.remoteProjectId}</small></p>}
    </div>
    {(error || state?.lastError) && <p role="alert" className="error-box">{error || state?.lastError}</p>}
    {notice && <p role="status">{notice}</p>}
    {!!state?.conflicts.length && <section aria-label="Conflitos de sincronização"><h4>Revisar antes de substituir</h4>{state.conflicts.map(item => <div key={item.id} style={{ borderTop: '1px solid #dce3ed', paddingBlock: 12 }}>
      <strong>{item.entity} · registro {item.localId}</strong><p>Há alterações locais e online. A decisão vale somente para este registro.</p>
      <details><summary>Comparar dados</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 240, overflow: 'auto' }}>{JSON.stringify({ local: (item as any).localPayload, online: (item as any).remotePayload }, null, 2)}</pre></details>
      <div className="setting-actions"><Button variant="secondary" disabled={busy || state.running} onClick={() => setResolution({ id: item.id, choice: 'keep_local' })}>Manter dados locais</Button><Button variant="secondary" disabled={busy || state.running} onClick={() => setResolution({ id: item.id, choice: 'accept_remote' })}>Usar dados online</Button></div>
    </div>)}</section>}
    <Confirm open={confirmation} title="Confirmar publicação desta obra" description={`${company?.razao_social || ''} / ${work?.nome || ''} → ${remote?.company || ''} / ${remote?.project || ''}. A sincronização enviará dados operacionais e indicadores dos módulos autorizados, além de obrigações financeiras quando houver permissão. Não vincule obras diferentes.`} onCancel={() => setConfirmation(false)} onConfirm={() => { setConfirmation(false); void perform(() => window.fluxoDre.online.configureSync({ companyId: Number(companyId), workId: Number(workId) }), 'Vínculo de sincronização configurado.') }}/>
    <Confirm open={!!resolution} title="Resolver divergência" description={resolution?.choice === 'accept_remote' ? 'Os campos operacionais locais deste registro serão substituídos pelos dados online. Esta decisão será registrada.' : 'Os dados locais deste registro serão priorizados e preparados para envio ao online. Esta decisão será registrada.'} onCancel={() => setResolution(null)} onConfirm={() => { const selected = resolution!; setResolution(null); void perform(() => window.fluxoDre.online.resolveLocalConflict(selected.id, selected.choice), 'Conflito revisado. Acompanhe a próxima sincronização.') }}/>
  </Card>
}
