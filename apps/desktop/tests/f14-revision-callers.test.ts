import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relative:string) => readFileSync(resolve(here, relative), 'utf8')

describe('F14 Desktop revision callers', () => {
  it('remembers the revision actually observed by generic entity views and reuses it on delete', () => {
    const source = read('../electron/services/data-access-service.cjs')
    expect(source).toContain('observedRevisions')
    expect(source).toContain('rememberRevision')
    expect(source).toContain('expectedRevision ?? this.observedRevisions.get')
    expect(source).toContain('this.rememberMany(table, await this.remote.list')
    expect(source).toContain('this.rememberRevision(table, await this.remote.get')
    expect(source).toContain('this.rememberRevision(table, await this.remote.save')
  })

  it('maps the observed RDO root revision to expectedRevision before the LAN call', () => {
    const source = read('../electron/services/field-source-service.cjs')
    expect(source).toContain('expectedRevision: expectedRevision ?? revision')
    expect(source).toContain('equipe.map(withoutRevision)')
    expect(source).toContain('this.lanClient.saveDailyReport(remotePayload(payload))')
  })

  it('reuses and advances the observed payroll sheet revision at the RH source boundary', () => {
    const source = read('../electron/services/rh-source-service.cjs')
    expect(source).toContain('payrollRevisions')
    expect(source).toContain('payload.expectedRevision ?? this.payrollRevisions.get')
    expect(source).toContain('result?.sheetRevision')
  })

  it('reuses and advances the observed monthly time revision for autofill and save', () => {
    const source = read('../electron/services/rh-source-service.cjs')
    expect(source).toContain('timeRevisions')
    expect(source).toContain('payload.expectedRevision ?? this.timeRevisions.get')
    expect(source).toContain('this.lanClient.timeAutoFill({ ...payload, expectedRevision })')
    expect(source).toContain('this.lanClient.timeSave({ ...payload, expectedRevision })')
  })
})
