import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SyncCoordinator } = require('./sync-coordinator.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LanSyncDataProvider } = require('./lan-sync-data-provider.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LanDataClient } = require('./lan-data-client.cjs')

const TOKEN = 'e2e-obra360'
const lan = (file: string) => import(pathToFileURL(path.resolve(__dirname, '../../../lan-server/src', file)).href)

describe('Obra360 de ponta a ponta com o Obra na Mão Server real', () => {
  it('celular → Desktop (servidor próprio) → banco do servidor → telas', async () => {
    const { LanRepository } = await lan('repository.mjs')
    const { createLanServer } = await lan('server.mjs')
    const repository = new LanRepository({ filename: ':memory:' })
    repository.applyMigrations(path.resolve(__dirname, '../../../lan-server/migrations'))
    const company = repository.save('empresas', { razao_social: 'Empresa' })
    const client = repository.save('clientes', { empresa_id: company.id, nome: 'Cliente' })
    const work = repository.save('obras', { empresa_id: company.id, cliente_id: client.id, nome: 'Obra', status: 'ativa' })
    const stage = repository.save('etapas_obra', { obra_id: work.id, nome: 'Alvenaria' })
    const hash = (v: string) => createHash('sha256').update(v).digest('hex')
    const server = createLanServer({ repository, security: {
      serverState: () => ({ claimed: true, companyId: 'cloud-a' }),
      deviceByTokenHash: (v: string) => v === hash(TOKEN) ? { id: 'd', memberId: 'm', status: 'active' } : null,
      member: (id: string) => id === 'm' ? { memberId: 'm', email: 'a@b.c', role: 'admin', modules: ['obra360', 'rdo', 'rh'], channels: ['desktop'], status: 'active' } : null,
      touchDevice() {},
    } })
    server.listen(0, '127.0.0.1'); await once(server, 'listening')
    try {
      const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`
      const lanClient = new LanDataClient({ storage: { state: () => ({ mode: 'server', baseUrl, serverId: 's1' }) }, credentials: { token: () => TOKEN } })
      const provider = new LanSyncDataProvider({ lanClient })
      const coordinator = Object.create(SyncCoordinator.prototype)
      coordinator.now = () => Date.now()
      coordinator.dataProvider = { runtimeState: () => ({ source: 'remote' }), obra360: (op: string, p: any) => provider.obra360(op, p) }
      const service = `etapa:${stage.id}`
      await coordinator.applyFieldInbox({ remoteProjectId: 'p1', workId: work.id, remoteCompanyId: 'cloud-a' }, { changed: true, snapshot: {
        floors: [{ number: 0, stages: [{ service, status: 'in_progress', checklist: [], updatedAt: '2026-11-26T12:00:00.000Z' }] }],
        history: [{ id: 'h1', floor: 0, service, date: '2026-11-26', time: '09:00', label: 'Alvenaria Térreo: em execução' }],
        issues: [{ id: 'i1', title: 'Falta bloco', status: 'open' }],
      } })
      expect(coordinator.inboxIssue).toBeUndefined()
      const progress = await coordinator.obra360('progressList', { workId: work.id })
      expect(progress).toEqual([expect.objectContaining({ nivel: 0, service, status: 'in_progress', origin: 'campo' })])
      const history = await coordinator.obra360('historyList', { workId: work.id })
      expect(history[0]).toMatchObject({ label: 'Alvenaria Térreo: em execução', origin: 'campo' })
      expect(repository.connection().prepare('SELECT titulo FROM tarefas_obra WHERE obra_id=?').all(work.id)).toEqual([{ titulo: 'Falta bloco' }])
    } finally { server.close(); await once(server, 'close'); repository.close() }
  })
})
