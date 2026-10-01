import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relative:string) => readFileSync(resolve(here, relative), 'utf8')

describe('F14 Desktop revision callers', () => {
  it('remembers the revision actually observed by generic entity views and reuses it on delete', () => {
    const preload = read('../electron/preload.cjs')
    expect(preload).toContain('entityRevisions')
    expect(preload).toContain('rememberEntityRevision')
    expect(preload).toContain('revision ?? entityRevisions.get')
    expect(preload).toContain("call('entity:list'")
    expect(preload).toContain("call('entity:get'")
    expect(preload).toContain("call('entity:save'")
    expect(preload).toContain("call('entity:remove'")
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
