export type LicensedPlatformSystem = 'gestao' | 'obra360' | 'universidade' | 'finance'

export type PlatformAuthorizationInput = {
  systemEnabled: boolean
  licenseActive: boolean
  licenseModules: readonly string[]
  isExplicitAdmin: boolean
}

const REQUIRED_MODULE: Partial<Record<LicensedPlatformSystem, string>> = {
  obra360: 'obra360',
  universidade: 'universidade',
  finance: 'finance'
}

export function canAccessPlatformSystem(system: LicensedPlatformSystem, input: PlatformAuthorizationInput) {
  if (input.isExplicitAdmin) return true
  if (!input.systemEnabled || !input.licenseActive) return false
  const required = REQUIRED_MODULE[system]
  return required ? input.licenseModules.includes(required) : true
}

export function canUseFinanceAi(input: {
  licenseActive: boolean
  licenseModules: readonly string[]
  isExplicitAdmin: boolean
}) {
  if (input.isExplicitAdmin) return true
  return input.licenseActive && input.licenseModules.includes('finance') && input.licenseModules.includes('ai')
}
