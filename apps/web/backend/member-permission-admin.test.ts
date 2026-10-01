import { describe, expect, it } from 'vitest'
import {
  assertAdministrativeTransition,
  permissionChangeSummary,
  validatePermissionAdministration
} from './member-permission-admin'

describe('granular permission administration safeguards', () => {
  it('rejects modules and channels outside company entitlements', () => {
    expect(() => validatePermissionAdministration({
      role: 'employee',
      modules: ['obra360', 'finance'],
      channels: ['desktop', 'mobile'],
      permissions: { core: ['view'], finance: ['view'] },
      companyModules: ['obra360'],
      companyChannels: ['desktop']
    })).toThrow(/módulo|licença/i)

    expect(() => validatePermissionAdministration({
      role: 'employee',
      modules: ['obra360'],
      channels: ['desktop', 'mobile'],
      permissions: { core: ['view'] },
      companyModules: ['obra360'],
      companyChannels: ['desktop']
    })).toThrow(/canal|licença/i)
  })

  it('rejects permission actions for a domain not enabled by selected modules', () => {
    expect(() => validatePermissionAdministration({
      role: 'employee',
      modules: ['obra360'],
      channels: ['desktop'],
      permissions: { core: ['view'], finance: ['view'] },
      companyModules: ['obra360', 'finance'],
      companyChannels: ['desktop']
    })).toThrow(/finance|domínio|módulo/i)
  })

  it('normalizes valid actions and returns the effective preview', () => {
    const result = validatePermissionAdministration({
      role: 'foreman',
      modules: ['obra360', 'rdo'],
      channels: ['desktop'],
      permissions: { core: ['view', 'edit', 'write'], operation: ['view', 'approve'] } as never,
      companyModules: ['obra360', 'rdo', 'finance'],
      companyChannels: ['desktop', 'mobile']
    })
    expect(result.storedPermissions.core).toEqual(['view', 'edit'])
    expect(result.storedPermissions.operation).toEqual(['view', 'approve'])
    expect(result.effectivePermissions.core).toEqual(['view', 'edit'])
    expect(result.effectivePermissions.operation).toEqual(['view', 'approve'])
  })

  it('protects canonical owner and the last administrator from demotion', () => {
    expect(() => assertAdministrativeTransition({
      target: { role: 'admin', canonicalOwner: true }, nextRole: 'foreman', activeAdminCount: 3
    })).toThrow(/proprietário|owner/i)

    expect(() => assertAdministrativeTransition({
      target: { role: 'admin', canonicalOwner: false }, nextRole: 'employee', activeAdminCount: 1
    })).toThrow(/último administrador/i)

    expect(() => assertAdministrativeTransition({
      target: { role: 'admin', canonicalOwner: false }, nextRole: 'foreman', activeAdminCount: 2
    })).not.toThrow()
  })

  it('produces an audit-safe summary only for role/modules/channels/permissions changes', () => {
    const diff = permissionChangeSummary(
      { role: 'employee', modules: ['obra360'], channels: ['mobile'], permissions: { core: ['view'] }, token: 'secret' } as never,
      { role: 'foreman', modules: ['obra360', 'rdo'], channels: ['desktop'], permissions: { core: ['view', 'edit'], operation: ['view'] }, token: 'other-secret' } as never
    )
    expect(diff).toEqual({
      role: { before: 'employee', after: 'foreman' },
      modules: { before: ['obra360'], after: ['obra360', 'rdo'] },
      channels: { before: ['mobile'], after: ['desktop'] },
      permissions: {
        before: { core: ['view'], operation: [], planning: [], finance: [], rh: [] },
        after: { core: ['view', 'edit'], operation: ['view'], planning: [], finance: [], rh: [] }
      }
    })
    expect(JSON.stringify(diff)).not.toContain('secret')
  })
})
