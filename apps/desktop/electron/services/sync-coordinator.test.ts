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
