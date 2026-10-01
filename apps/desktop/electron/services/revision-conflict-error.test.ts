import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('RevisionConflictError', () => {
  it('preserves server metadata without changing it or retrying implicitly', () => {
    const { RevisionConflictError } = require('./revision-conflict-error.cjs')
    const current = { id:9, nome:'Versão atual', revision:4 }
    const error = new RevisionConflictError({
      resourceType:'obras',
      resourceId:'9',
      expectedRevision:3,
      currentRevision:4,
      current
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RevisionConflictError')
    expect(error.code).toBe('revision_conflict')
    expect(error.status).toBe(409)
    expect(error.message).toBe('Este registro foi alterado em outro computador.')
    expect(error.resourceType).toBe('obras')
    expect(error.resourceId).toBe('9')
    expect(error.expectedRevision).toBe(3)
    expect(error.currentRevision).toBe(4)
    expect(error.current).toBe(current)
  })
})
