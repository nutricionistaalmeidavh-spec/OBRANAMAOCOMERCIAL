import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { DatabaseService } = require('../electron/services/database.cjs')
const { DataAccessService } = require('../electron/services/data-access-service.cjs')

it('Desktop aplica as mesmas regras da cadeia de locais e liga pendências e ocorrências', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locais-desktop-'))
  const service = new DatabaseService({ dataDir: dir, migrationsDir: path.resolve(import.meta.dirname, '../database/migrations') })
  try {
    service.open()
    const company = service.save('empresas', { razao_social: 'Empresa' })
    const work = service.save('obras', { empresa_id: company.id, nome: 'Obra', status: 'ativa' })
    const other = service.save('obras', { empresa_id: company.id, nome: 'Outra', status: 'ativa' })
    const floor = service.save('locais_obra', { obra_id: work.id, nome: 'Térreo', nivel: 0 })
    const guarita = service.save('locais_obra', { obra_id: work.id, nome: 'Guarita', local_pai_id: floor.id })
    expect(() => service.save('locais_obra', { obra_id: work.id, nome: '1º', nivel: 1, local_pai_id: floor.id })).toThrow(/Pavimento fica direto/)
    expect(() => service.save('locais_obra', { id: floor.id, nivel: null, local_pai_id: guarita.id })).toThrow(/dentro dele mesmo/)
    expect(() => service.save('tarefas_obra', { obra_id: other.id, titulo: 'X', local_id: guarita.id })).toThrow(/mesma obra/)
    const task = service.save('tarefas_obra', { obra_id: work.id, titulo: 'Portão', local_id: guarita.id })
    expect(task.local_id).toBe(guarita.id)
    const rdo = service.save('rdos', { obra_id: work.id, data: '2026-11-26' })
    expect(() => service.save('rdo_ocorrencias', { rdo_id: rdo.id, tipo: 'qualidade', descricao: 'x', local_id: 9999 })).toThrow(/não encontrado/)
    expect(() => service.remove('locais_obra', floor.id)).toThrow()
    service.save('rdo_equipe', { rdo_id: rdo.id, nome: 'Pedreiros', local_id: guarita.id, horas: 8 })
    service.save('rdo_ocorrencias', { rdo_id: rdo.id, tipo: 'qualidade', descricao: 'Trinca', local_id: guarita.id })
    const counts = await new DataAccessService({ db: service, storage: { state: () => ({ mode: 'local' }) }, credentials: null }).locationCounts(work.id)
    expect(counts.byLocal[guarita.id]).toEqual({ tasks: 1, occurrences: 1, own: 2, total: 2 })
    expect(counts.byLocal[floor.id].total).toBe(2)
  } finally { service.close?.() }
})
