import { useEffect, useState } from 'react'
import { Button, Card, Confirm, Field } from './ui'
import { useAsync } from '../hooks/useAsync'
import type { DesktopSyncState, LocalConflictResolution } from '../../../../packages/contracts/src/desktop-sync'

const ENTITY_LABELS:Record<string,string>={tarefas_obra:'Tarefa',frentes_obra:'Frente',rdos:'RDO',cronograma_etapas:'Planejamento'}
const FIELD_LABELS:Record<string,string>={status:'Status',titulo:'Título',nome:'Nome',responsavel:'Responsável',prazo:'Prazo',prioridade:'Prioridade',descricao:'Descrição',observacoes:'Observações',percentual_realizado:'Progresso',clima:'Clima',atividades:'Atividades'}
function readableValue(value:unknown){if(value===null||value===undefined||value==='')return'—';if(Array.isArray(value))return value.map(readableValue).join(', ');if(typeof value==='object')return JSON.stringify(value);return String(value)}
function conflictRows(item:any){const local=item.localPayload||{},obra=item.remotePayload||{},keys=Array.from(new Set([...Object.keys(local),...Object.keys(obra)])).filter(key=>!['deleted','updatedAt','lastAppliedChangeId','appliedChangeIds'].includes(key));return keys.filter(key=>JSON.stringify(local[key]??null)!==JSON.stringify(obra[key]??null)).slice(0,8).map(key=>({key,label:FIELD_LABELS[key]||key,local:readableValue(local[key]),obra:readableValue(obra[key])}))}
function conflictTitle(item:any){const local=item.localPayload||{},obra=item.remotePayload||{},payload={...obra,...local};if(payload.titulo)return String(payload.titulo);if(payload.nome)return String(payload.nome);if(item.entity==='rdos'&&payload.data)return 'RDO '+String(payload.data);return (ENTITY_LABELS[item.entity]||item.entity)+' · registro '+String(item.localId)}

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
    const apply = (value:DesktopSyncState) => { if (active) setState(value) }
    const update = () => window.fluxoDre.online.syncState().then(apply).catch(reason => { if (active) setError(reason.message) })
    const unsubscribe = window.fluxoDre.online.onSyncStateChanged(apply)
    const onVisibility = () => { if (document.visibilityState === 'visible') void update() }
    void update()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
  const lanClient = state?.source === 'lan-client'
  return <>
    <Card className="setting-card setting-card-feature" id="sync-settings">
      <h3>Sincronização da obra</h3>
      <p>Escolha qual obra deste computador deve continuar disponível também no Obra360. As demais obras permanecem separadas.</p>
      <p><strong>Celular e Desktop trabalham sobre a mesma obra.</strong> Depois do vínculo, as alterações são conciliadas automaticamente quando houver conexão.</p>
      {lanClient && <p role="status"><strong>A sincronização central é responsabilidade do PC principal.</strong> Este computador continua usando os dados do servidor da empresa e acompanha o estado online, mas não executa push/pull central diretamente.</p>}
      <div className="form-grid">
        <Field label="Empresa local"><select value={companyId} disabled={busy || lanClient} onChange={event => { setCompanyId(event.target.value); setWorkId('') }}><option value="">Selecione...</option>{companies.data?.map(item => <option key={item.id} value={item.id}>{item.razao_social || item.nome_fantasia}</option>)}</select></Field>
        <Field label="Obra local"><select value={workId} disabled={busy || lanClient || !companyId} onChange={event => setWorkId(event.target.value)}><option value="">Selecione...</option>{choices.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      </div>
      <div className="setting-actions">
        <Button disabled={busy || lanClient || !company || !work} onClick={prepare}>Conferir vínculo e ativar</Button>
        <Button variant="secondary" disabled={busy || !state?.configured || state.paused || state.running} onClick={() => perform(() => window.fluxoDre.online.syncNow(), 'Tentativa concluída. Confira as pendências abaixo.')}>Sincronizar agora</Button>
      </div>
      <div role="status" aria-live="polite" style={{ marginTop: 12 }}>
        <strong>{state?.running ? 'Sincronizando...' : state?.paused ? (state.pauseReason || 'Pausada — confira o vínculo') : state?.configured ? 'Sincronização automática ativa' : 'Ainda não configurada'}</strong>
        <p>{state?.pending ?? 0} alteração(ões) aguardando envio · {state?.conflicts.length ?? 0} conflito(s)</p>
        <small>Última atualização: {state?.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString('pt-BR') : 'nenhuma'}. Se a rede falhar, o trabalho deste computador é preservado.</small>
        {state?.scope && <div><p><strong>{state.scope.companyName} / {state.scope.workName}</strong></p><details><summary>Detalhes técnicos</summary><small>Destino: {state.scope.baseUrl} · obra remota {state.scope.remoteProjectId}</small></details></div>}
      </div>
      {(error || state?.lastError) && <p role="alert" className="error-box">{error || state?.lastError}</p>}
      {notice && <p role="status">{notice}</p>}
      {!!state?.conflicts.length && <section aria-label="Conflitos de sincronização"><h4>Escolha a versão correta</h4><p>Estes itens foram alterados no computador e no Obra360 antes da sincronização. Compare somente os campos diferentes.</p>{state.conflicts.map(item => {
        const rows=conflictRows(item)
        return <div key={item.id} style={{ borderTop: '1px solid #dce3ed', paddingBlock: 12 }}>
          <strong>{conflictTitle(item)}</strong>
          {rows.length?<div style={{display:'grid',gap:6,marginTop:10}}>
            <div style={{display:'grid',gridTemplateColumns:'minmax(100px,.8fr) minmax(0,1fr) minmax(0,1fr)',gap:8,fontSize:12,fontWeight:700}}><span>Campo</span><span>Versão deste computador</span><span>Versão do Obra360</span></div>
            {rows.map(row=><div key={row.key} style={{display:'grid',gridTemplateColumns:'minmax(100px,.8fr) minmax(0,1fr) minmax(0,1fr)',gap:8,borderTop:'1px solid #eef2f7',paddingTop:6,fontSize:12}}><strong>{row.label}</strong><span style={{overflowWrap:'anywhere'}}>{row.local}</span><span style={{overflowWrap:'anywhere'}}>{row.obra}</span></div>)}
          </div>:<p>As versões mudaram em momentos diferentes, mas não há campo simples para comparar. Escolha a origem que deve prevalecer.</p>}
          <div className="setting-actions"><Button variant="secondary" disabled={busy || state.running} onClick={() => setResolution({ id: item.id, choice: 'keep_local' })}>Manter versão deste computador</Button><Button variant="secondary" disabled={busy || state.running} onClick={() => setResolution({ id: item.id, choice: 'accept_remote' })}>Usar versão do Obra360</Button></div>
        </div>
      })}</section>}
      <Confirm open={confirmation} title="Confirmar publicação desta obra" description={`${company?.razao_social || ''} / ${work?.nome || ''} → ${remote?.company || ''} / ${remote?.project || ''}. A sincronização enviará dados operacionais e indicadores dos módulos autorizados, além de obrigações financeiras quando houver permissão. Não vincule obras diferentes.`} onCancel={() => setConfirmation(false)} onConfirm={() => { setConfirmation(false); void perform(() => window.fluxoDre.online.configureSync({ companyId: Number(companyId), workId: Number(workId) }), 'Vínculo de sincronização configurado.') }}/>
      <Confirm open={!!resolution} title="Resolver divergência" description={resolution?.choice === 'accept_remote' ? 'A versão do Obra360 substituirá os campos divergentes deste computador. Esta decisão será registrada.' : 'A versão deste computador será mantida e enviada ao Obra360 na próxima sincronização. Esta decisão será registrada.'} onCancel={() => setResolution(null)} onConfirm={() => { const selected = resolution!; setResolution(null); void perform(() => window.fluxoDre.online.resolveLocalConflict(selected.id, selected.choice), 'Conflito revisado. Acompanhe a próxima sincronização.') }}/>
    </Card>
  </>
}
