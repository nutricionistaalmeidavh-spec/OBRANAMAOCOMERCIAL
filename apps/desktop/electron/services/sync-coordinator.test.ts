import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const { SyncCoordinator } = require('./sync-coordinator.cjs')
const fixtures: any[] = []
function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-sync-'))
  const database = new DatabaseService({ dataDir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  database.open()
  const company = database.save('empresas', { razao_social: 'Local', status: 'ativa' })
  const work = database.save('obras', { empresa_id: company.id, nome: 'Obra A' })
  const task = database.save('tarefas_obra', { obra_id: work.id, titulo: 'Instalar tubo', status: 'aberta' })
  const session = { authorized: true, company: { id: 'company-a' }, project: { id: 'project-a' }, device: { id: 'device-a' }, access: { modules: ['obra360', 'finance', 'dre', 'rdo', 'documents'] } }
  const online = {
    state: () => ({ linked: true, baseUrl: 'https://test.example' }),
    session: vi.fn(async () => session),
    syncPull: vi.fn(async (_revision: number) => ({ changed: false })),
    syncPush: vi.fn(async (changes: any[]) => ({ accepted: changes.map(c => ({ changeId: c.changeId, status: 'accepted', bridged: true })) })),
    publishMobileSummary: vi.fn(async (_summary: any) => ({ ok: true })),
    publishFinanceReference: vi.fn(async (_obligations: any[]) => ({ accepted: 1 })),
    resolveConflict: vi.fn(async () => ({ ok: true }))
  }
  const stateChanged = vi.fn()
  const sync = new SyncCoordinator({ database, online, now: () => Date.parse('2026-09-05T12:00:00Z'), onStateChanged: stateChanged })
  const f = { dataDir, database, company, work, task, online, session, sync, stateChanged }
  fixtures.push(f)
  return f
}
afterEach(async () => {
  for (const f of fixtures.splice(0)) { await f.sync.stop(); f.database.close(); fs.rmSync(f.dataDir, { recursive: true, force: true }) }
})
it('persists changes while offline and retries the same id after restart', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  f.online.syncPush.mockRejectedValueOnce(new Error('offline'))
  await expect(f.sync.run()).rejects.toThrow('offline')
  const changeId = f.online.syncPush.mock.calls[0][0][0].changeId
  f.database.close(); f.database.open()
  f.sync = new SyncCoordinator({ database: f.database, online: f.online })
  await f.sync.run({ retryNow: true })
  expect(f.online.syncPush.mock.calls[1][0][0].changeId).toBe(changeId)
  expect(f.sync.state().pending).toBe(0)
  f.database.save('tarefas_obra', { ...f.task, titulo: 'Mudança offline' })
  f.online.session.mockRejectedValueOnce(new Error('offline'))
  await expect(f.sync.run()).rejects.toThrow('offline')
  expect(f.sync.state().pending).toBeGreaterThan(0)
})
it('publishes state transitions without renderer polling', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  expect(f.stateChanged).toHaveBeenCalledWith(expect.objectContaining({ configured: true }))
  f.stateChanged.mockClear()
  await f.sync.run()
  const states = f.stateChanged.mock.calls.map((call:any[]) => call[0])
  expect(states.some((state:any) => state.running === true)).toBe(true)
  expect(states.at(-1)).toMatchObject({ running: false, pending: 0 })
})

it('does not send old jobs to another remote device or project', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  f.session.device.id = 'device-b'
  await expect(f.sync.run()).rejects.toThrow(/Vínculo online mudou/)
  expect(f.online.syncPush).not.toHaveBeenCalled()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  await f.sync.run()
  expect(f.database.db.prepare("SELECT COUNT(*) n FROM desktop_sync_outbox WHERE status='pending'").get().n).toBeGreaterThan(0)
  expect(f.sync.state().pending).toBe(0)
})
it('applies remote changes only for its device and creates a manual conflict on concurrent local edits', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id }); await f.sync.run()
  const remote = (device: string, revision: number, title: string) => ({ changed: true, remoteRevision: revision, snapshot: { desktopBridge: { tasks: [{ sourceDeviceId: device, localId: f.task.id, mobileEditedRevision: revision, payload: { titulo: title } }] } } })
  f.online.syncPull.mockResolvedValue(remote('other-device', 1, 'Não alterar') as any)
  await f.sync.run()
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Instalar tubo')
  f.online.syncPull.mockResolvedValue(remote('device-a', 2, 'Título remoto') as any)
  await f.sync.run()
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Título remoto')
  f.database.save('tarefas_obra', { ...f.database.get('tarefas_obra', f.task.id), titulo: 'Título local' })
  f.online.syncPull.mockResolvedValue(remote('device-a', 3, 'Remoto concorrente') as any)
  await f.sync.run()
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Título local')
  expect(f.sync.state().conflicts).toHaveLength(1)
  await f.sync.resolveLocalConflict(f.sync.state().conflicts[0].id, 'accept_remote')
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Remoto concorrente')
  expect(f.sync.state().conflicts).toHaveLength(0)
})
it('publishes actual partial-payment balances in cents and excludes another work', async () => {
  const f = fixture()
  const account = f.database.save('contas', { empresa_id: f.company.id, obra_id: f.work.id, tipo: 'pagar', descricao: 'Tubos', valor_centavos: 10000, competencia: '2026-09', vencimento: '2026-09-01' })
  f.database.accountPayment(account.id, { valor_centavos: 4000, data: '2026-09-01' })
  const other = f.database.save('obras', { empresa_id: f.company.id, nome: 'Outra obra' })
  f.database.save('contas', { empresa_id: f.company.id, obra_id: other.id, tipo: 'pagar', descricao: 'Outra', valor_centavos: 90000, competencia: '2026-09', vencimento: '2026-09-01' })
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id }); await f.sync.run()
  const summary = f.online.publishMobileSummary.mock.calls.at(-1)![0]
  expect(summary.modules.finance.payableCents).toBe(6000)
  expect(summary.modules.finance.overdueCents).toBe(6000)
  expect(summary.modules.dre.expense).toBe(4000)
  expect(summary.modules.dre.result).toBe(-4000)
  expect(f.online.publishFinanceReference).toHaveBeenCalledTimes(1)
})
it('stop waits for in-flight HTTP before allowing the database to close', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  let release!: () => void
  f.online.syncPull.mockImplementationOnce(async () => { await new Promise<void>(r => { release = r }); return { changed: false } })
  const running = f.sync.run().catch(() => {})
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  let stopped = false
  const stopping = f.sync.stop().then(() => { stopped = true })
  await Promise.resolve(); expect(stopped).toBe(false)
  release(); await stopping; await running
  expect(stopped).toBe(true)
  expect(f.online.syncPush).not.toHaveBeenCalled()
})
it('sincroniza somente bridges centrais anunciadas e aplica edição PWA na fonte central', async () => {
  const f = fixture()
  const centralTask: any = { id: 701, obra_id: 601, titulo: 'Tarefa central', status: 'aberta' }
  const centralFront: any = { id: 702, obra_id: 601, nome: 'Frente central', status: 'ativa' }
  const centralRdo: any = { id: 703, obra_id: 601, data: '2026-09-30', atividades: 'Atividade central', status: 'aberto' }
  const rows: Record<string, any[]> = { frentes_obra: [centralFront], tarefas_obra: [centralTask], rdos: [centralRdo] }
  const dataProvider = {
    runtimeState: () => ({ source: 'lan-host', paused: false, pauseReason: null }),
    resolveScope: vi.fn(async () => ({ companyId: 501, workId: 601, companyName: 'Empresa central', workName: 'Obra central' })),
    syncCapabilities: vi.fn(async () => ({ version: 1, modules: ['core', 'operation'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos'] })),
    listBridge: vi.fn(async (entity: string) => {
      if (!Object.hasOwn(rows, entity)) throw new Error(`bridge não suportada: ${entity}`)
      return rows[entity]
    }),
    getBridge: vi.fn(async (entity: string, id: number) => rows[entity]?.find(row => row.id === id) || null),
    applyRemote: vi.fn(async (entity: string, id: number, payload: any) => {
      const row = rows[entity]?.find(item => item.id === id)
      if (!row) return false
      Object.assign(row, payload)
      return true
    }),
    summary: vi.fn(async () => { throw new Error('summary ainda não centralizado') }),
    obligations: vi.fn(async () => { throw new Error('financeiro ainda não centralizado') })
  }
  f.session.access.modules = ['obra360']
  f.sync = new SyncCoordinator({ database: f.database, online: f.online, dataProvider, now: () => Date.parse('2026-09-30T12:00:00Z') })

  await f.sync.configure({ companyId: 501, workId: 601 })
  await f.sync.run()
  expect(dataProvider.listBridge).not.toHaveBeenCalledWith('cronograma_etapas', expect.anything())
  expect(dataProvider.summary).not.toHaveBeenCalled()
  expect(dataProvider.obligations).not.toHaveBeenCalled()
  const pushed = f.online.syncPush.mock.calls.flatMap((call: any[]) => call[0])
  expect(pushed.some((change: any) => change.entity === 'tarefas_obra' && change.localId === centralTask.id && change.payload.titulo === 'Tarefa central')).toBe(true)

  f.online.syncPull.mockResolvedValue({
    changed: true,
    remoteRevision: 2,
    snapshot: { desktopBridge: { tasks: [{ sourceDeviceId: 'device-a', localId: centralTask.id, mobileEditedRevision: 2, payload: { titulo: 'Editada no PWA' } }] } }
  } as any)
  await f.sync.run()
  expect(centralTask.titulo).toBe('Editada no PWA')
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Instalar tubo')
})


it('remote só inicia a sincronização se o mesmo Desktop reivindicar o coordenador na Cloud', async () => {
  const f=fixture()
  const centralRows=[{id:83,obra_id:601,titulo:'Tarefa remota',status:'aberta'}]
  const dataProvider={
    storage:{state:()=>({mode:'server',operationalMode:'remote',serverId:'server-remote-01'})},
    runtimeState:()=>({source:'remote',paused:false,pauseReason:null}),
    resolveScope:vi.fn(async()=>({companyId:501,workId:601,companyName:'Empresa própria',workName:'Obra remota'})),
    syncCapabilities:vi.fn(async()=>({modules:['core','operation'],bridgeEntities:['tarefas_obra']})),
    listBridge:vi.fn(async()=>centralRows),
    getBridge:vi.fn(async (_entity:string,id:number)=>centralRows.find(row=>row.id===id)||null),
    applyRemote:vi.fn(async (_entity:string,id:number,payload:any)=>{Object.assign(centralRows.find(row=>row.id===id)!,payload);return true}),
    summary:vi.fn(async()=>({modules:{}})),
    obligations:vi.fn(async()=>[])
  }
  const claim=vi.fn(async()=>({owner:true,deviceId:'device-a',serverId:'server-remote-01'}))
  Object.assign(f.online,{claimRemoteSyncOwner:claim})
  f.session.access.modules=['obra360']
  f.sync=new SyncCoordinator({database:f.database,online:f.online,dataProvider,now:()=>Date.parse('2026-11-15T22:00:00Z')})
  await f.sync.configure({companyId:501,workId:601})
  await f.sync.run()
  expect(claim).toHaveBeenCalledTimes(2)
  expect(claim).toHaveBeenCalledWith('server-remote-01')
  expect(f.online.syncPush).toHaveBeenCalled()
  expect(f.online.syncPush.mock.calls.flatMap((call:any[])=>call[0]).some((change:any)=>change.localId===83&&change.payload.titulo==='Tarefa remota')).toBe(true)
})

it('remote recusa coordenador diferente sem capturar ou publicar cópia local', async () => {
  const f=fixture()
  const dataProvider={
    storage:{state:()=>({mode:'server',operationalMode:'remote',serverId:'server-remote-01'})},
    runtimeState:()=>({source:'remote',paused:false,pauseReason:null}),
    resolveScope:vi.fn(async()=>({companyId:501,workId:601,companyName:'Empresa própria',workName:'Obra remota'})),
    syncCapabilities:vi.fn(async()=>({modules:['core'],bridgeEntities:['tarefas_obra']})),
    listBridge:vi.fn(async()=>[{id:88,obra_id:601,titulo:'Não publicar'}]),
    getBridge:vi.fn(),
    applyRemote:vi.fn(),
    summary:vi.fn(),
    obligations:vi.fn()
  }
  f.online.claimRemoteSyncOwner=vi.fn(async()=>{throw new Error('Outro Desktop está designado coordenador desta obra.')})
  f.sync=new SyncCoordinator({database:f.database,online:f.online,dataProvider})
  await expect(f.sync.configure({companyId:501,workId:601})).rejects.toThrow(/Outro Desktop/)
  expect(dataProvider.resolveScope).toHaveBeenCalledTimes(1)
  expect(dataProvider.listBridge).not.toHaveBeenCalled()
  expect(f.online.syncPush).not.toHaveBeenCalled()
})


it('remote nunca envia fila anterior de SQLite local ou de outro serverId',async()=>{
 const f=fixture()
 await f.sync.configure({companyId:f.company.id,workId:f.work.id})
 const prior=f.sync.binding()
 const priorScopeKey=f.sync.key(prior.scope)
 const cloudClaim=vi.fn(async()=>({owner:true,deviceId:'device-a',serverId:'server-remote-01'}))
 f.online.claimRemoteSyncOwner=cloudClaim
 let serverId='server-remote-01'
 const rows=[{id:701,obra_id:601,titulo:'Somente servidor remoto',status:'aberta'}]
 const dataProvider={
  storage:{state:()=>({mode:'server',operationalMode:'remote',serverId})},
  runtimeState:()=>({source:'remote',paused:false,pauseReason:null}),
  resolveScope:vi.fn(async()=>({companyId:f.company.id,workId:f.work.id,companyName:'Empresa',workName:'Obra'})),
  syncCapabilities:vi.fn(async()=>({modules:['core','operation'],bridgeEntities:['tarefas_obra']})),
  listBridge:vi.fn(async()=>rows),
  getBridge:vi.fn(async(_entity:string,id:number)=>rows.find(r=>r.id===id)||null),
  applyRemote:vi.fn(),
  summary:vi.fn(),obligations:vi.fn()
 }
 const remoteSync=new SyncCoordinator({database:f.database,online:f.online,dataProvider})
 f.sync=remoteSync
 await expect(remoteSync.run()).rejects.toThrow(/reconfirme o vínculo/)
 expect(f.online.syncPush).not.toHaveBeenCalled()
 await remoteSync.configure({companyId:f.company.id,workId:f.work.id})
 expect(remoteSync.binding().scope).toMatchObject({storageMode:'remote',serverId:'server-remote-01'})
 expect(remoteSync.key(remoteSync.binding().scope)).not.toBe(priorScopeKey)
 serverId='server-remote-02'
 expect(remoteSync.state()).toMatchObject({paused:true,source:'remote'})
 await expect(remoteSync.run()).rejects.toThrow(/reconfirme o vínculo/)
 expect(f.online.syncPush).not.toHaveBeenCalled()
})
it('isolates a rejected field RDO: other days, catalog failures and the outbox keep flowing', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  f.online.publishMobileSummary.mockClear()
  const reports = [
    { date: '2026-11-20', fingerprint: 'fp-a', report: { photos: [] } },
    { date: '2026-11-21', fingerprint: 'fp-b', report: { photos: [] } }
  ]
  Object.assign(f.online, {
    fieldRdoCatalogPublish: vi.fn(async () => { throw new Error('Catálogo de materiais não corresponde ao contrato operacional.') }),
    fieldRdoPending: vi.fn(async () => ({ reports })),
    fieldRdoPhoto: vi.fn(),
    fieldRdoAck: vi.fn(async () => ({ ok: true })),
    fieldRdoReject: vi.fn(async () => ({ status: 'rejected' }))
  })
  f.sync.dataProvider.fieldRdoCatalog = vi.fn(async () => ({ schemaVersion: 1 }))
  f.sync.dataProvider.applyFieldRdo = vi.fn(async (_scope: any, report: any) => {
    if (report.date === '2026-11-20') throw new Error('Saldo insuficiente para Tubo PVC (m). Disponível: 2.')
    return { localRdoId: 9, materialRevision: 1 }
  })
  f.database.save('tarefas_obra', { ...f.task, titulo: 'Alteração que precisa ir para a web' })
  await f.sync.run()
  expect(f.online.fieldRdoReject).toHaveBeenCalledWith({ date: '2026-11-20', fingerprint: 'fp-a', reason: expect.stringContaining('Saldo insuficiente') })
  expect(f.online.fieldRdoAck).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-21', localRdoId: 9 }))
  expect(f.online.publishMobileSummary).toHaveBeenCalled()
  expect(f.sync.state().pending).toBe(0)
  const issues = f.sync.state().fieldRdoIssues
  expect(issues.map((i: any) => i.kind).sort()).toEqual(['catalog', 'rdo'])
})
it('does not reject an RDO when only the photo transport failed', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  Object.assign(f.online, {
    fieldRdoPending: vi.fn(async () => ({ reports: [{ date: '2026-11-22', fingerprint: 'fp-c', report: { photos: [{ id: 'p1', sha256: 'a'.repeat(64), contentType: 'image/jpeg' }] } }] })),
    fieldRdoPhoto: vi.fn(async () => { throw new Error('A conexão online excedeu 30 segundos.') }),
    fieldRdoAck: vi.fn(),
    fieldRdoReject: vi.fn()
  })
  f.sync.dataProvider.applyFieldRdo = vi.fn()
  await f.sync.run()
  expect(f.online.fieldRdoReject).not.toHaveBeenCalled()
  expect(f.sync.dataProvider.applyFieldRdo).not.toHaveBeenCalled()
  expect(f.sync.state().fieldRdoIssues[0]).toMatchObject({ kind: 'transport', date: '2026-11-22' })
})
it('acknowledges a diary imported with pending consumption and lists it persistently for the office', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  const rdo = f.database.save('rdos', { obra_id: f.work.id, data: '2026-11-23', status: 'rascunho' })
  Object.assign(f.online, {
    fieldRdoPending: vi.fn(async () => ({ reports: [{ date: '2026-11-23', fingerprint: 'fp-d', report: { photos: [] } }] })),
    fieldRdoPhoto: vi.fn(), fieldRdoReject: vi.fn(),
    fieldRdoAck: vi.fn(async () => ({ ok: true }))
  })
  f.sync.dataProvider.applyFieldRdo = vi.fn(async () => {
    f.database.db.prepare("INSERT INTO field_rdo_pendencias(rdo_id,kind,request_id,payload_json,message) VALUES(?,'material','r',?,?)").run(rdo.id, JSON.stringify({ items: [] }), 'Saldo insuficiente para Tubo (m). Disponível: 1.')
    return { localRdoId: rdo.id, materialRevision: 0, materialPending: 'Saldo insuficiente para Tubo (m). Disponível: 1.' }
  })
  await f.sync.run()
  expect(f.online.fieldRdoReject).not.toHaveBeenCalled()
  expect(f.online.fieldRdoAck).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-23', materialPending: expect.stringContaining('Saldo insuficiente') }))
  expect(f.sync.state().fieldRdoPendingConsumption).toEqual([{ rdoId: rdo.id, date: '2026-11-23', message: expect.stringContaining('Saldo insuficiente') }])
  expect(f.sync.state().fieldRdoIssues[0]).toMatchObject({ kind: 'material', code: 'material_pending' })
})
it('offers to join a phone diary to the office RDO and retries that day immediately', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  Object.assign(f.online, {
    fieldRdoPending: vi.fn(async () => ({ reports: [{ date: '2026-11-24', fingerprint: 'fp-e', report: { photos: [] } }] })),
    fieldRdoPhoto: vi.fn(), fieldRdoAck: vi.fn(async () => ({ ok: true })),
    fieldRdoReject: vi.fn(async () => ({ status: 'rejected' }))
  })
  f.sync.dataProvider.applyFieldRdo = vi.fn(async () => { throw new Error('RDO digitado no escritório em 24/11/2026: o escritório precisa juntar este diário ao RDO existente no Desktop (Configurações > Sincronização).') })
  await f.sync.run()
  expect(f.sync.state().fieldRdoIssues[0]).toMatchObject({ kind: 'rdo', code: 'manual_rdo_exists', date: '2026-11-24' })
  f.sync.dataProvider.linkFieldRdo = vi.fn(async () => ({ rdoId: 3, date: '2026-11-24' }))
  f.sync.dataProvider.applyFieldRdo = vi.fn(async () => ({ localRdoId: 3, materialRevision: 1 }))
  await f.sync.linkFieldRdo('2026-11-24')
  await f.sync.run({ retryNow: true })
  expect(f.sync.dataProvider.linkFieldRdo).toHaveBeenCalledWith(expect.objectContaining({ workId: f.work.id }), '2026-11-24')
  expect(f.online.fieldRdoPending).toHaveBeenCalledWith({ retryDates: ['2026-11-24'] })
  expect(f.online.fieldRdoAck).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-24', localRdoId: 3 }))
})
function multiobra(f: any) {
  const second = f.database.save('obras', { empresa_id: f.company.id, nome: 'Obra B' })
  const secondTask = f.database.save('tarefas_obra', { obra_id: second.id, titulo: 'Tarefa da obra B', status: 'aberta' })
  Object.assign(f.online, {
    listAuthorizedProjects: vi.fn(async () => ({ projects: [{ id: 'project-a', name: 'Obra A', primary: true, modules: ['obra360'] }, { id: 'project-b', name: 'Obra B', modules: ['obra360'] }], limits: { maxProjects: 5, used: 2 } })),
    createProject: vi.fn(async ({ name, localWorkId }: any) => ({ project: { id: 'project-new-' + localWorkId, name, localWorkId }, created: true }))
  })
  return { second, secondTask }
}
it('publishes an additional work to its own online project and keeps the primary work untouched', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  await f.sync.run()
  const { second, secondTask } = multiobra(f)
  const listing = await f.sync.listProjects()
  expect(listing.localWorks.find((w: any) => w.id === second.id)?.bound).toBe(false)
  await f.sync.addProject({ workId: second.id, remoteProjectId: 'project-b' })
  await expect(f.sync.addProject({ workId: second.id })).rejects.toThrow('já recebe dados')
  f.online.syncPush.mockClear()
  await f.sync.run()
  const pushed = f.online.syncPush.mock.calls.flatMap((call: any[]) => call[0])
  expect(pushed.some((change: any) => change.entity === 'tarefas_obra' && change.localId === secondTask.id)).toBe(true)
  expect(pushed.some((change: any) => change.entity === 'tarefas_obra' && change.localId === f.task.id)).toBe(false)
  const state = f.sync.state()
  expect(state.projects).toHaveLength(1)
  expect(state.projects[0]).toMatchObject({ workId: second.id, remoteProjectId: 'project-b', lastError: null })
  expect(state.projects[0].lastSyncAt).toBeTruthy()
})
it('isolates a failing additional work from the primary one', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  const { second } = multiobra(f)
  await f.sync.addProject({ workId: second.id, remoteProjectId: 'project-b' })
  f.online.listAuthorizedProjects.mockResolvedValue({ projects: [{ id: 'project-a', name: 'Obra A', primary: true, modules: ['obra360'] }], limits: null })
  f.sync.projectListCache = null
  await f.sync.run()
  const state = f.sync.state()
  expect(state.lastError).toBeNull()
  expect(state.projects[0].lastError).toMatch(/Vínculo online mudou/)
})
it('publishes works created after the update automatically and never the existing ones silently', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  const { second } = multiobra(f)
  await f.sync.run()
  expect(f.online.createProject).not.toHaveBeenCalled()
  const third = f.database.save('obras', { empresa_id: f.company.id, nome: 'Obra C nova' })
  await f.sync.run()
  expect(f.online.createProject).toHaveBeenCalledTimes(1)
  expect(f.online.createProject).toHaveBeenCalledWith({ name: 'Obra C nova', localWorkId: third.id })
  expect(f.sync.state().projects.map((p: any) => p.workId)).toEqual([third.id])
  expect((await f.sync.listProjects()).localWorks.find((w: any) => w.id === second.id).bound).toBe(false)
})
it('stops automatic publication at the license limit and tells the office', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  multiobra(f)
  await f.sync.run()
  f.online.createProject.mockRejectedValue(new Error('Limite de 2 obra(s) da licença atingido. Fale com o suporte para ampliar.'))
  f.database.save('obras', { empresa_id: f.company.id, nome: 'Obra D' })
  await f.sync.run()
  expect(f.sync.state().projectIssues[0].message).toMatch(/Limite de 2 obra/)
  expect(f.sync.state().lastError).toBeNull()
})
it('sends projectId on every Desktop call of an additional work through the real online client', async () => {
  const { OnlineService } = require('./online-service.cjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-online-'))
  const bodies: any[] = []
  const fetchImpl = vi.fn(async (url: string, init: any) => { bodies.push({ route: new URL(url).pathname, body: JSON.parse(init.body || '{}') }); return { ok: true, json: async () => ({ reports: [] }), headers: { get: () => null } } })
  const online = new OnlineService({ dataDir: dir, baseUrl: 'https://example.test', fetchImpl })
  online.storeToken('d'.repeat(64))
  const sync = new SyncCoordinator({ database: { db: null }, online })
  await sync.projectOnline('project-b').fieldRdoPending()
  await sync.projectOnline('project-b').syncPush([])
  await online.fieldRdoPending()
  expect(bodies.map(b => [b.route, b.body.projectId])).toEqual([['/api/desktop/field/rdo/pending', 'project-b'], ['/api/desktop/sync/push', 'project-b'], ['/api/desktop/field/rdo/pending', undefined]])
  fs.rmSync(dir, { recursive: true, force: true })
})
it('never publishes automatically a work created by spreadsheet import', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  multiobra(f)
  await f.sync.run()
  const imported = f.database.save('obras', { empresa_id: f.company.id, nome: 'Obra da planilha' })
  f.database.db.prepare('INSERT INTO desktop_sync_skip_auto(work_id) VALUES(?)').run(imported.id)
  await f.sync.run()
  expect(f.online.createProject).not.toHaveBeenCalled()
  expect((await f.sync.listProjects()).localWorks.find((w: any) => w.id === imported.id).bound).toBe(false)
})

it('does not offer or publish a local work from another company', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  multiobra(f)
  const company = f.database.save('empresas', { razao_social: 'Outra empresa fictícia', status: 'ativa' })
  const work = f.database.save('obras', { empresa_id: company.id, nome: 'Obra de outra empresa' })
  expect((await f.sync.listProjects()).localWorks.map((item: any) => item.id)).not.toContain(work.id)
  await expect(f.sync.addProject({ workId: work.id })).rejects.toThrow(/empresa/)
  expect(f.online.createProject).not.toHaveBeenCalled()
})

it('validates the current online identity before publishing another work', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  const { second } = multiobra(f)
  f.session.company.id = 'company-other'
  await expect(f.sync.addProject({ workId: second.id })).rejects.toThrow(/Vínculo online mudou/)
  expect(f.online.createProject).not.toHaveBeenCalled()
})

it('recovers a legacy imported work from its unique device-scoped online identity', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  const { second } = multiobra(f)
  f.database.db.prepare('INSERT INTO desktop_sync_skip_auto(work_id) VALUES(?)').run(second.id)
  f.online.listAuthorizedProjects.mockResolvedValue({
    projects: [
      { id: 'same-name', name: second.nome, modules: ['rdo'] },
      { id: 'canonical', name: 'Nome online atualizado', localWorkId: second.id, modules: ['rdo'] }
    ],
    limits: { maxProjects: 2, used: 2 }
  })
  await f.sync.run()
  expect(f.sync.state().projects).toEqual([expect.objectContaining({ workId: second.id, remoteProjectId: 'canonical' })])
  expect(f.online.createProject).not.toHaveBeenCalled()
})

it('joins a phone diary to the explicitly selected additional work', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  const { second } = multiobra(f)
  await f.sync.addProject({ workId: second.id, remoteProjectId: 'project-b' })
  const link = vi.fn(async () => ({ rdoId: 3, date: '2026-11-24' }))
  f.sync.dataProvider.linkFieldRdo = link
  await expect(f.sync.linkFieldRdo('2026-11-24', second.id + 100)).rejects.toThrow(/obra/)
  expect(link).not.toHaveBeenCalled()
  await f.sync.linkFieldRdo('2026-11-24', second.id)
  expect(link).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    workId: second.id,
    remoteProjectId: 'project-b'
  }), '2026-11-24')
})

it('upgrades a fictitious 2.1.14 database and resumes its original authorized outbox', async () => {
  const { OnlineService } = require('./online-service.cjs')
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obn-upgrade-214-'))
  const migrationsDir = path.resolve(import.meta.dirname, '../../database/migrations')
  const oldMigrations = path.join(dataDir, 'schema-214')
  let database: any
  try {
    fs.mkdirSync(oldMigrations)
    // Migration 026 is the last migration shipped in desktop-commercial-v2.1.14.
    for (const file of fs.readdirSync(migrationsDir).filter(name => /^\d+.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 26)) {
      fs.copyFileSync(path.join(migrationsDir, file), path.join(oldMigrations, file))
    }
    database = new DatabaseService({ dataDir, migrationsDir: oldMigrations })
    database.open()
    expect(database.db.pragma('user_version', { simple: true })).toBe(26)
    const company = database.save('empresas', { razao_social: 'Empresa fictícia', status: 'ativa' })
    const work = database.save('obras', { empresa_id: company.id, nome: 'Obra migrada' })
    const task = database.save('tarefas_obra', { obra_id: work.id, titulo: 'Tarefa offline', status: 'aberta' })
    const session = {
      authorized: true, company: { id: 'company-test' }, project: { id: 'project-test' },
      device: { id: 'device-test' }, user: { email: 'fixture@example.test' },
      access: { licenseId: 'license-test', modules: ['obra360'] }
    }
    const baseUrl = 'https://mock.example.test'
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => session, headers: { get: () => null } }))
    const online = new OnlineService({ dataDir, baseUrl, fetchImpl, qaLinked: false })
    online.writeConfig({ baseUrl, installationId: 'fictional-installation-id', tenant: { companyId: session.company.id, baseUrl } })
    online.storeToken('fictional-test-token')
    const config = fs.readFileSync(online.configPath, 'utf8')
    const offlineSince = Date.parse('2026-08-01T12:00:00Z')
    const legacyCoordinator = new SyncCoordinator({ database, online, now: () => offlineSince })
    legacyCoordinator.dataProvider.summary = () => null
    await legacyCoordinator.configure({ companyId: company.id, workId: work.id })
    online.syncPull = vi.fn(async () => ({ changed: false }))
    online.syncPush = vi.fn(async () => { throw new Error('rede indisponível') })
    await expect(legacyCoordinator.run()).rejects.toThrow('rede indisponível')
    const queued = database.db.prepare('SELECT change_id FROM desktop_sync_outbox WHERE entity=? AND local_id=?').get('tarefas_obra', task.id)
    database.close()

    database = new DatabaseService({ dataDir, migrationsDir })
    database.open()
    expect(database.db.pragma('user_version', { simple: true })).toBeGreaterThan(26)
    const backupDir = path.join(dataDir, 'backups', 'pre-migration')
    const [backupFile] = fs.readdirSync(backupDir)
    const backup = new (require('better-sqlite3'))(path.join(backupDir, backupFile), { readonly: true })
    try {
      expect(backup.pragma('user_version', { simple: true })).toBe(26)
      expect(backup.prepare('SELECT titulo FROM tarefas_obra WHERE id=?').get(task.id).titulo).toBe('Tarefa offline')
    } finally { backup.close() }
    expect(database.get('tarefas_obra', task.id).titulo).toBe('Tarefa offline')
    expect(fs.readFileSync(online.configPath, 'utf8')).toBe(config)
    const reopened = new OnlineService({ dataDir, baseUrl, fetchImpl, qaLinked: false })
    expect(reopened.installationId()).toBe('fictional-installation-id')
    expect(reopened.deviceToken()).toBe('fictional-test-token')
    expect((await reopened.session()).access.licenseId).toBe('license-test')
    reopened.syncPull = vi.fn(async () => ({ changed: false }))
    reopened.publishMobileSummary = vi.fn(async () => ({ ok: true }))
    const syncPush = vi.fn(async (changes: any[]) => ({ accepted: changes.map(change => ({ changeId: change.changeId, status: 'accepted' })) }))
    reopened.syncPush = syncPush
    const coordinator = new SyncCoordinator({ database, online: reopened, now: () => offlineSince + 90 * 86400000 })
    await coordinator.run()
    expect(syncPush.mock.calls.flatMap(([changes]) => changes).some(change => change.changeId === queued.change_id)).toBe(true)
    expect(coordinator.state().pending).toBe(0)
  } finally {
    database?.close()
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
})
it('applies phone records to their canonical owners: issues become tasks, attendance waits for review in the Ponto', async () => {
  const { TimeService } = require('./time-service.cjs')
  const { createHash } = require('node:crypto')
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  const maria = f.database.save('funcionarios', { empresa_id: f.company.id, obra_atual_id: f.work.id, nome: 'Maria', status: 'ativo' })
  const fieldId = 'rdo_emp_' + createHash('sha256').update(JSON.stringify([f.company.id, f.work.id, maria.id])).digest('hex').slice(0, 24)
  const snapshot = (issueStatus: string, attendance: string) => ({
    issues: [{ id: 'issue-1', type: 'blocked', title: 'Falta tubo 25 mm', floor: 0, service: 'etapa:3', reason: 'Fornecedor atrasou', status: issueStatus }],
    days: { '2026-11-24': { date: '2026-11-24', attendance: { [fieldId]: attendance, 'legacy-joao': 'absent' }, events: [] } },
    employees: [{ id: 'legacy-joao', name: 'João (lista do celular)' }]
  })
  f.online.syncPull.mockResolvedValue({ changed: true, remoteRevision: 5, snapshot: snapshot('open', 'present') })
  await f.sync.run()
  const task = f.database.db.prepare("SELECT * FROM tarefas_obra WHERE titulo='Falta tubo 25 mm'").get() as any
  expect(task).toMatchObject({ obra_id: f.work.id, prioridade: 'alta', status: 'aberta' })
  const inbox = f.sync.fieldInbox()
  const pending = inbox.pending([f.work.id])
  expect(pending.map((p: any) => [p.kind, p.name, p.funcionarioId])).toEqual([['attendance', 'Maria', maria.id], ['attendance', 'João (lista do celular)', null]])
  // Nothing touched the Ponto yet.
  const time = new TimeService({ db: f.database, fileService: null })
  expect(time.get({ funcionario_id: maria.id, competencia: '2026-11' }).marks.find((m: any) => m.data === '2026-11-24')).toBeUndefined()
  // The office already marked a day off: the phone never overwrites it silently.
  time.save({ funcionario_id: maria.id, competencia: '2026-11', marks: [{ data: '2026-11-24', tipo: 'folga' }] })
  const mariaRow = pending.find((p: any) => p.funcionarioId === maria.id)
  expect(() => inbox.applyItem({ id: mariaRow.id, workIds: [f.work.id] }, time)).toThrow(/Confirme para substituir/)
  inbox.applyItem({ id: mariaRow.id, overwrite: true, workIds: [f.work.id] }, time)
  expect(time.get({ funcionario_id: maria.id, competencia: '2026-11' }).marks.find((m: any) => m.data === '2026-11-24')).toMatchObject({ tipo: 'trabalho', entrada: '07:00' })
  // Unknown legacy person: must be matched by the office, never by name.
  const joaoRow = pending.find((p: any) => p.funcionarioId === null)
  expect(() => inbox.applyItem({ id: joaoRow.id, workIds: [f.work.id] }, time)).toThrow(/Escolha o funcionário/)
  // Resolving on the phone completes the task; changing attendance after launch goes back to review.
  f.online.syncPull.mockResolvedValue({ changed: true, remoteRevision: 6, snapshot: snapshot('resolved', 'absent') })
  await f.sync.run()
  expect((f.database.get('tarefas_obra', task.id) as any).status).toBe('concluida')
  expect(f.database.db.prepare("SELECT COUNT(*) n FROM tarefas_obra WHERE titulo='Falta tubo 25 mm'").get()).toEqual({ n: 1 })
  const again = inbox.pending([f.work.id]).find((p: any) => p.funcionarioId === maria.id)
  expect(again).toMatchObject({ status: 'absent', message: expect.stringContaining('Alterado no celular') })
})

it('recovers a legacy additional project from its RDO ledger without matching names or creating duplicate projects', async()=>{
 const f=fixture()
 await f.sync.configure({companyId:f.company.id,workId:f.work.id})
 const {second}=multiobra(f)
 const rdo=f.database.save('rdos',{obra_id:second.id,data:'2026-11-24'})
 f.database.db.prepare('INSERT INTO field_rdo_links(remote_project_id,day,rdo_id) VALUES(?,?,?)').run('project-b','2026-11-24',rdo.id)
 f.database.db.prepare('INSERT INTO desktop_sync_skip_auto(work_id) VALUES(?)').run(second.id)
 await f.sync.run()
 expect(f.sync.state().projects).toEqual([expect.objectContaining({workId:second.id,remoteProjectId:'project-b'})])
 expect(f.online.createProject).not.toHaveBeenCalled()
})
it('does not bind an additional project when cloud identity contradicts local RDO receipts',async()=>{
 const f=fixture()
 await f.sync.configure({companyId:f.company.id,workId:f.work.id})
 const {second}=multiobra(f)
 const third=f.database.save('obras',{empresa_id:f.company.id,nome:'Outra obra'})
 const rdo=f.database.save('rdos',{obra_id:second.id,data:'2026-11-24'})
 f.database.db.prepare('INSERT INTO field_rdo_links(remote_project_id,day,rdo_id) VALUES(?,?,?)').run('project-b','2026-11-24',rdo.id)
 f.online.listAuthorizedProjects.mockResolvedValue({projects:[{id:'project-a',primary:true},{id:'project-b',localWorkId:third.id}],limits:null})
 await f.sync.run()
 expect(f.sync.state().projects).toEqual([])
 expect(f.online.createProject).not.toHaveBeenCalled()
})
