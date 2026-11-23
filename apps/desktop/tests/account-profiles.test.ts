import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createAccountProfiles } = require('../electron/services/account-profiles.cjs')

describe('contas desktop no mesmo computador', () => {
  it('preserva a pasta legada e separa os dados por email', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-accounts-'))
    try {
      const app = { getPath: () => root }
      const principal = createAccountProfiles(app, ['electron'])
      expect(principal.dataDir).toBe(path.join(root, 'obra-na-mao-comercial'))
      principal.bind('antigo@empresa.com')
      const other = principal.add('demo@empresa.com')
      const demo = createAccountProfiles(app, ['electron', '--obra-account=' + other.id])
      expect(demo.dataDir).not.toBe(principal.dataDir)
      expect(demo.current().email).toBe('demo@empresa.com')
      expect(() => demo.bind('antigo@empresa.com')).toThrow()
      expect(principal.add('DEMO@EMPRESA.COM').id).toBe(other.id)
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  })
})
