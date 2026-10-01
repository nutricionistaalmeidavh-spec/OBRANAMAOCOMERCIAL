import { describe, expect, it } from 'vitest'
import {
  PERMISSION_ACTIONS,
  PERMISSION_DOMAINS,
  effectivePermissions,
  permissionsRevision,
  roleTemplate
} from './member-permissions'

describe('member permission contract', () => {
  it('uses only the five approved domains and actions', () => {
    expect(PERMISSION_DOMAINS).toEqual(['core', 'operation', 'planning', 'finance', 'rh'])
    expect(PERMISSION_ACTIONS).toEqual(['view', 'create', 'edit', 'delete', 'approve'])
  })

  it('gives admin full actions only inside entitled modules and Desktop channel', () => {
    const matrix = effectivePermissions({
      role: 'admin',
      modules: ['obra360', 'finance'],
      channels: ['desktop'],
      companyModules: ['obra360', 'finance', 'rh'],
      companyChannels: ['desktop', 'mobile']
    })
    expect(matrix.core).toEqual(PERMISSION_ACTIONS)
    expect(matrix.operation).toEqual(PERMISSION_ACTIONS)
    expect(matrix.planning).toEqual(PERMISSION_ACTIONS)
    expect(matrix.finance).toEqual(PERMISSION_ACTIONS)
    expect(matrix.rh).toEqual([])
  })

  it('keeps foreman and employee templates independent by action', () => {
    expect(roleTemplate('foreman')).toMatchObject({
      core: ['view', 'create', 'edit'],
      operation: ['view', 'create', 'edit', 'approve'],
      planning: ['view', 'edit']
    })
    expect(roleTemplate('employee')).toMatchObject({
      core: ['view'],
      operation: ['view', 'create'],
      planning: ['view']
    })
  })

  it('allows custom restriction or expansion only inside effective entitlements', () => {
    const matrix = effectivePermissions({
      role: 'employee',
      customPermissions: {
        core: ['view', 'edit', 'delete'],
        operation: ['approve'],
        finance: ['view', 'approve'],
        rh: ['view']
      },
      modules: ['obra360', 'rdo', 'finance', 'rh'],
      channels: ['desktop'],
      companyModules: ['obra360', 'rdo', 'finance'],
      companyChannels: ['desktop']
    })
    expect(matrix.core).toEqual(['view', 'edit', 'delete'])
    expect(matrix.operation).toEqual(['approve'])
    expect(matrix.finance).toEqual(['view', 'approve'])
    expect(matrix.rh).toEqual([])
  })

  it('removes invalid domains/actions and returns no LAN permissions without Desktop entitlement', () => {
    const matrix = effectivePermissions({
      role: 'admin',
      customPermissions: {
        core: ['view', 'write', 'edit'],
        unknown: ['view'],
        finance: ['pay', 'approve']
      } as never,
      modules: ['obra360', 'finance'],
      channels: ['mobile'],
      companyModules: ['obra360', 'finance'],
      companyChannels: ['desktop', 'mobile']
    })
    for (const domain of PERMISSION_DOMAINS) expect(matrix[domain]).toEqual([])
  })

  it('produces a stable revision that changes when effective permissions change', () => {
    const first = effectivePermissions({
      role: 'employee',
      modules: ['obra360'], channels: ['desktop'],
      companyModules: ['obra360'], companyChannels: ['desktop']
    })
    const same = effectivePermissions({
      role: 'employee',
      modules: ['obra360'], channels: ['desktop'],
      companyModules: ['obra360'], companyChannels: ['desktop']
    })
    const changed = effectivePermissions({
      role: 'employee',
      customPermissions: { core: ['view', 'edit'] },
      modules: ['obra360'], channels: ['desktop'],
      companyModules: ['obra360'], companyChannels: ['desktop']
    })
    expect(permissionsRevision(first)).toBe(permissionsRevision(same))
    expect(permissionsRevision(first)).not.toBe(permissionsRevision(changed))
    expect(permissionsRevision(first)).toMatch(/^perm-v1-[a-f0-9]{8}$/)
  })
})
