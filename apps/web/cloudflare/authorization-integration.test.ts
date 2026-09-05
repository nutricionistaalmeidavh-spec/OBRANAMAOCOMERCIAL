import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const indexSource = readFileSync(new URL('../backend/index.ts', import.meta.url), 'utf8')
const platformSource = readFileSync(new URL('../backend/platform-access.ts', import.meta.url), 'utf8')

describe('authorization wiring', () => {
  it('maps Universidade and IA into the license module catalog', () => {
    expect(indexSource).toContain("'universidade','ai'")
  })

  it('binds platform decisions to current company entitlements', () => {
    expect(indexSource).toContain('configurePlatformEntitlementResolver')
    expect(platformSource).toContain('effectiveSystemAccess')
    expect(platformSource).toContain('!entitlementResolver')
    expect(platformSource).toContain("(access.companyIds||[]).includes(scopedCompany)")
  })

  it('rechecks the current company license for Finance and Universidade', () => {
    expect(indexSource).toContain("companyAccess.modules.includes('finance')")
    expect(indexSource).toContain("companyAccess?.modules.includes('universidade')")
  })

  it('requires current Finance + IA entitlement for desktop AI', () => {
    expect(indexSource).toContain('canUseFinanceAi')
    expect(indexSource).toContain("individualFinance=explicitAdmin||session.access.modules.includes('finance')")
    expect(indexSource).toContain('licenseModules:companyAccess?.modules||[]')
  })

  it('does not trust caller-provided superadmin flags', () => {
    expect(platformSource).toContain('isSuperadmin=email===superadminEmail()')
    expect(platformSource).not.toContain('input.isSuperadmin===true||')
  })
})
