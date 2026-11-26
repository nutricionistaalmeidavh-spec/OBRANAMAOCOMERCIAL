import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { DatabaseService } = require('../electron/services/database.cjs')
const { DataAccessService } = require('../electron/services/data-access-service.cjs')
const { locationsPdfHtml, floorProgress } = require('../electron/services/location-pdf.cjs')

it('gera em lote no Desktop (prévia e aplicação) e monta o PDF do mapa', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locais-p4-'))
  const service = new DatabaseService({ dataDir: dir, migrationsDir: path.resolve(import.meta.dirname, '../database/migrations') })
  try {
    service.open()
    const company = service.save('empresas', { razao_social: 'E' })
    const work = service.save('obras', { empresa_id: company.id, nome: 'Torre <A>', status: 'ativa' })
    const access = new DataAccessService({ db: service, storage: { state: () => ({ mode: 'local' }) }, credentials: null })
    const spec = { criarPavimentos: true, faixas: [{ de: 1, ate: 2, unidades: 2, padrao: 'numero', prefixo: 'Apto', duplex: false, ambientes: 'Sala, Banho' }, { de: 3, ate: 4, unidades: 1, padrao: 'letra', prefixo: 'Cobertura', duplex: true, ambientes: '' }] }
    const preview = await access.locationBatch(work.id, spec, true)
    expect(preview).toMatchObject({ floors: 4, units: 5, upper: 1, rooms: 8, total: 18 })
    expect(service.list('locais_obra', { obra_id: work.id })).toHaveLength(0)
    await access.locationBatch(work.id, spec, false)
    const rows = service.list('locais_obra', { obra_id: work.id })
    expect(rows).toHaveLength(18)
    expect(rows.some((r: any) => r.nome === 'Cobertura 3A — piso superior')).toBe(true)
    expect((await access.locationBatch(work.id, spec, true)).total).toBe(0)
    const html = locationsPdfHtml({ work, rows, counts: await access.locationCounts(work.id), progress: floorProgress([{ nivel: 1, status: 'completed' }, { nivel: 1, status: 'in_progress' }]) })
    expect(html).toContain('Torre &lt;A&gt;')
    expect(html).toContain('75% concluído')
    expect(html).toContain('Cobertura 3A')
  } finally { service.close?.() }
})
