import { describe, expect, it } from 'vitest'
import { PERMISSION_ACTIONS, PERMISSION_DOMAINS } from '../backend/member-permissions'
import {
  editorPermissionMatrix,
  governancePermissionState,
  isCustomPermissionMatrix,
  permissionMatrixRows
} from './admin-governance-permissions'

describe('governance granular permission editor model', () => {
  it('renders exactly every domain × action as mobile-safe independent controls', () => {
    const rows = permissionMatrixRows()
    expect(rows.map(row => row.domain)).toEqual(PERMISSION_DOMAINS)
    for (const row of rows) expect(row.actions.map(action => action.action)).toEqual(PERMISSION_ACTIONS)
    expect(rows.flatMap(row => row.actions).every(action => action.inputType === 'checkbox')).toBe(true)
  })

  it('uses role template only when member has no stored custom matrix', () => {
    const foreman = editorPermissionMatrix('foreman', undefined)
    expect(foreman.operation).toEqual(['view', 'create', 'edit', 'approve'])
    expect(foreman.finance).toEqual([])

    const custom = editorPermissionMatrix('foreman', { operation: ['view'], finance: ['view'] })
    expect(custom.operation).toEqual(['view'])
    expect(custom.finance).toEqual(['view'])
  })

  it('detects custom state without mutating it on role/template comparison', () => {
    const baseline = editorPermissionMatrix('employee', undefined)
    expect(isCustomPermissionMatrix('employee', baseline)).toBe(false)
    expect(isCustomPermissionMatrix('employee', { ...baseline, core: ['view', 'edit'] })).toBe(true)
  })

  it('separates selected values from effective values capped by modules/license/channel', () => {
    const state = governancePermissionState({
      role: 'admin',
      storedPermissions: {
        core: ['view', 'edit'],
        finance: ['view', 'approve'],
        rh: ['view']
      },
      modules: ['obra360', 'finance', 'rh'],
      channels: ['desktop'],
      companyModules: ['obra360', 'finance'],
      companyChannels: ['desktop', 'mobile']
    })
    expect(state.selected.rh).toEqual(['view'])
    expect(state.effective.rh).toEqual([])
    expect(state.effective.finance).toEqual(['view', 'approve'])
    expect(state.blockedDomains).toContain('rh')
    expect(state.desktopEnabled).toBe(true)
  })

  it('keeps selections visible but effective permissions empty when Desktop is unavailable', () => {
    const state = governancePermissionState({
      role: 'admin',
      storedPermissions: { core: ['view', 'edit'] },
      modules: ['obra360'],
      channels: ['mobile'],
      companyModules: ['obra360'],
      companyChannels: ['desktop', 'mobile']
    })
    expect(state.selected.core).toEqual(['view', 'edit'])
    expect(state.effective.core).toEqual([])
    expect(state.desktopEnabled).toBe(false)
  })
})
