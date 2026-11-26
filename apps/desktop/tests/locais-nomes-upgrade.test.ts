import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { DatabaseService } = require('../electron/services/database.cjs')

it('041 reconstrói locais sem perder ids nem vínculos e libera nomes repetidos em locais diferentes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locais-041-')), old = path.join(dir, 'old'), current = path.resolve(import.meta.dirname, '../database/migrations')
  fs.mkdirSync(old)
  for (const name of fs.readdirSync(current).filter((n) => /^\d+.*\.sql$/.test(n) && Number(n.match(/^\d+/)![0]) <= 40)) fs.copyFileSync(path.join(current, name), path.join(old, name))
  const service = new DatabaseService({ dataDir: dir, migrationsDir: old })
  try {
    service.open()
    const company = service.save('empresas', { razao_social: 'E' })
    const work = service.save('obras', { empresa_id: company.id, nome: 'O', status: 'ativa' })
    const floor = service.save('locais_obra', { obra_id: work.id, nome: '1º pavimento', nivel: 1 })
    const a101 = service.save('locais_obra', { obra_id: work.id, nome: 'Apto 101', local_pai_id: floor.id })
    service.save('locais_obra', { obra_id: work.id, nome: 'Sala', local_pai_id: a101.id })
    const task = service.save('tarefas_obra', { obra_id: work.id, titulo: 'T', local_id: a101.id })
    service.migrationsDir = current
    service.migrate(false)
    expect(service.db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(41)
    expect(service.db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(service.get('tarefas_obra', task.id).local_id).toBe(a101.id)
    expect(service.get('locais_obra', a101.id).local_pai_id).toBe(floor.id)
    const a102 = service.save('locais_obra', { obra_id: work.id, nome: 'Apto 102', local_pai_id: floor.id })
    expect(service.save('locais_obra', { obra_id: work.id, nome: 'Sala', local_pai_id: a102.id }).nome).toBe('Sala')
    expect(() => service.save('locais_obra', { obra_id: work.id, nome: 'Sala', local_pai_id: a102.id })).toThrow()
    expect(() => service.remove('locais_obra', floor.id)).toThrow()
  } finally { service.close?.() }
})
