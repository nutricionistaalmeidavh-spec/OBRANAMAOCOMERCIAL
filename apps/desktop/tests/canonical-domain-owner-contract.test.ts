import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../../..')
const read = (relative:string) => fs.readFileSync(path.join(root, relative), 'utf8')

describe('canonical domain owner contract', () => {
  const consumers = [
    'apps/desktop/electron/services/payroll-service.cjs',
    'apps/lan-server/src/payroll-service.mjs',
    'apps/desktop/electron/services/planning-service.cjs',
    'apps/lan-server/src/planning-service.mjs',
    'apps/desktop/electron/services/field-service.cjs',
    'apps/lan-server/src/field-service.mjs',
    'apps/desktop/electron/services/database.cjs',
    'apps/lan-server/src/finance-service.mjs'
  ]

  it('todos os adapters de regras extraídas consomem o mesmo domain core', () => {
    for (const file of consumers) {
      const source = read(file)
      expect(source, file).toMatch(/@obranamao\/domain-core|\.\/domain-core\.cjs/)
    }
    expect(read('apps/lan-server/src/domain-core.cjs')).toContain('packages/domain-core/index.cjs')
  })

  it('não reintroduz cálculo duplicado de líquido da folha nos adapters', () => {
    for (const file of consumers.filter(file => file.includes('payroll-service'))) {
      const source = read(file)
      expect(source).not.toMatch(/credits\s*-\s*discounts/)
      expect(source).toContain('payrollAmount')
    }
  })

  it('mantém ownership, migração e ausência de fallback silencioso como baseline', () => {
    const contract = JSON.parse(read('packages/contracts/lan-data-contract.json'))
    expect(contract.principles.operationalSourceExclusive).toMatch(/OU Obra na Mão Server|nunca fallback silencioso/i)
    expect(contract.principles.pwaIndependent).toMatch(/Cloudflare\/D1/i)
    expect(contract.principles.migrationRule).toMatch(/backup.*importação.*validação.*commit.*sanidade/i)
  })
})
