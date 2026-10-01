import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relative:string) => readFileSync(resolve(here, relative), 'utf8')

describe('F14 Desktop revision callers', () => {
  it('carries the selected row revision through every central entity delete UI', () => {
    expect(read('../src/pages/WorksPage.tsx')).toContain('obras.remove(remove.id, remove.revision)')
    expect(read('../src/pages/FrontsPage.tsx')).toContain('frentes.remove(remove.item.id, remove.item.revision)')
    expect(read('../src/pages/BudgetPage.tsx')).toContain('orcamentos.remove(remove.id, remove.revision)')
    expect(read('../src/pages/FinancePage.tsx')).toContain('contas.remove(remove.id, remove.revision)')
    expect(read('../src/pages/SchedulePage.tsx')).toContain('cronograma.remove(remove.id, remove.revision)')
    expect(read('../src/pages/RegistriesPage.tsx')).toContain('cfg.api().remove(remove.id, remove.revision)')
    expect(read('../src/modules/command-center/FinancePage.tsx')).toContain('contas.remove(remove.id, remove.revision)')
  })

  it('carries the observed RDO root revision when editing the aggregate', () => {
    const source = read('../src/pages/DailyReportPage.tsx')
    expect(source).toContain('expectedRevision: form.revision')
    expect(source).toContain('window.fluxoDre.campo.saveRdo')
  })

  it('carries the observed payroll sheet revision when confirming a payment', () => {
    const source = read('../src/pages/PayrollPage.tsx')
    expect(source).toContain('expectedRevision:payroll.data?.sheet?.revision')
    expect(source).toContain('window.fluxoDre.folha.confirm')
  })

  it('carries the observed monthly time revision for autofill and save', () => {
    const source = read('../src/pages/TimeSheetPage.tsx')
    expect(source).toContain('expectedRevision:point.data?.point?.revision')
    expect(source).toContain('window.fluxoDre.ponto.autoFill')
    expect(source).toContain('window.fluxoDre.ponto.save')
  })
})
