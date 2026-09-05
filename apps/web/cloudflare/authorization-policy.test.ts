import { describe, expect, it } from 'vitest'
import { canAccessPlatformSystem, canUseFinanceAi } from '../backend/authorization-policy'

describe('authorization policy', () => {
  const base = {
    systemEnabled: true,
    licenseActive: true,
    licenseModules: ['finance'],
    isExplicitAdmin: false
  }

  it('denies finance when individual permission is enabled but the current license lacks finance', () => {
    expect(canAccessPlatformSystem('finance', { ...base, licenseModules: [] })).toBe(false)
  })

  it('allows finance only when individual permission and current license are both valid', () => {
    expect(canAccessPlatformSystem('finance', base)).toBe(true)
    expect(canAccessPlatformSystem('finance', { ...base, systemEnabled: false })).toBe(false)
    expect(canAccessPlatformSystem('finance', { ...base, licenseActive: false })).toBe(false)
  })

  it('requires a dedicated universidade entitlement', () => {
    expect(canAccessPlatformSystem('universidade', { ...base, licenseModules: ['finance'] })).toBe(false)
    expect(canAccessPlatformSystem('universidade', { ...base, licenseModules: ['universidade'] })).toBe(true)
  })

  it('requires an active license for gestao even without a dedicated module', () => {
    expect(canAccessPlatformSystem('gestao', { ...base, licenseModules: [] })).toBe(true)
    expect(canAccessPlatformSystem('gestao', { ...base, licenseActive: false, licenseModules: [] })).toBe(false)
  })

  it('preserves only an explicit administrative bypass', () => {
    expect(canAccessPlatformSystem('finance', {
      systemEnabled: false,
      licenseActive: false,
      licenseModules: [],
      isExplicitAdmin: true
    })).toBe(true)
  })

  it('requires both finance and ai entitlements for finance AI', () => {
    expect(canUseFinanceAi({ licenseActive: true, licenseModules: ['finance', 'ai'], isExplicitAdmin: false })).toBe(true)
    expect(canUseFinanceAi({ licenseActive: true, licenseModules: ['finance'], isExplicitAdmin: false })).toBe(false)
    expect(canUseFinanceAi({ licenseActive: true, licenseModules: ['ai'], isExplicitAdmin: false })).toBe(false)
    expect(canUseFinanceAi({ licenseActive: false, licenseModules: ['finance', 'ai'], isExplicitAdmin: false })).toBe(false)
  })
})
