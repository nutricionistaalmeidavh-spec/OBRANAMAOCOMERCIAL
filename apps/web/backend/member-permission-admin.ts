import {
  effectivePermissions,
  normalizePermissions,
  type MemberRole,
  type PermissionAction,
  type PermissionDomain,
  type PermissionMatrix
} from './member-permissions'

const DOMAIN_MODULES: Record<PermissionDomain, string[]> = {
  core: ['obra360'],
  operation: ['obra360', 'rdo'],
  planning: ['obra360'],
  finance: ['finance', 'dre'],
  rh: ['rh']
}

function unique(values: string[] = []) {
  return [...new Set(values.map(String))]
}

function sameArray(left: string[] = [], right: string[] = []) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function samePermissions(left: PermissionMatrix, right: PermissionMatrix) {
  return (Object.keys(left) as PermissionDomain[]).every(domain => sameArray(left[domain], right[domain]))
}

export function validatePermissionAdministration(input: {
  role: MemberRole
  modules?: string[]
  channels?: string[]
  permissions?: unknown
  companyModules?: string[]
  companyChannels?: string[]
}) {
  const modules = unique(input.modules || [])
  const channels = unique(input.channels || [])
  const companyModules = new Set((input.companyModules || []).map(String))
  const companyChannels = new Set((input.companyChannels || []).map(String))

  const invalidModule = modules.find(module => !companyModules.has(module))
  if (invalidModule) throw new Error(`Módulo ${invalidModule} não está disponível na licença da empresa.`)

  const invalidChannel = channels.find(channel => !companyChannels.has(channel))
  if (invalidChannel) throw new Error(`Canal ${invalidChannel} não está disponível na licença da empresa.`)

  const storedPermissions = normalizePermissions(input.permissions)
  for (const [domain, actions] of Object.entries(storedPermissions) as Array<[PermissionDomain, PermissionAction[]]>) {
    if (!actions.length) continue
    const enabled = DOMAIN_MODULES[domain].some(module => modules.includes(module))
    if (!enabled) throw new Error(`Permissões do domínio ${domain} exigem um módulo correspondente selecionado.`)
    if (domain === 'finance' && modules.includes('dre') && !modules.includes('finance')) {
      const invalid = actions.find(action => action !== 'view')
      if (invalid) throw new Error('O módulo DRE permite somente visualização no domínio Financeiro.')
    }
  }

  const preview = effectivePermissions({
    role: input.role,
    customPermissions: storedPermissions,
    modules,
    channels,
    companyModules: [...companyModules],
    companyChannels: [...companyChannels]
  })

  return { modules, channels, storedPermissions, effectivePermissions: preview }
}

export function assertAdministrativeTransition(input: {
  target: { role?: MemberRole; canonicalOwner?: boolean }
  nextRole: MemberRole
  activeAdminCount: number
}) {
  if (input.target?.canonicalOwner && input.nextRole !== 'admin') {
    throw new Error('O proprietário (owner) canônico não pode ser removido do papel Admin.')
  }
  if (input.target?.role === 'admin' && input.nextRole !== 'admin' && Number(input.activeAdminCount || 0) <= 1) {
    throw new Error('Não é permitido remover o último administrador ativo.')
  }
  return true
}

export function permissionChangeSummary(
  before: { role?: MemberRole; modules?: string[]; channels?: string[]; permissions?: unknown },
  after: { role?: MemberRole; modules?: string[]; channels?: string[]; permissions?: unknown }
) {
  const result: Record<string, unknown> = {}
  if (before.role !== after.role) result.role = { before: before.role, after: after.role }

  const beforeModules = unique(before.modules || [])
  const afterModules = unique(after.modules || [])
  if (!sameArray(beforeModules, afterModules)) result.modules = { before: beforeModules, after: afterModules }

  const beforeChannels = unique(before.channels || [])
  const afterChannels = unique(after.channels || [])
  if (!sameArray(beforeChannels, afterChannels)) result.channels = { before: beforeChannels, after: afterChannels }

  const beforePermissions = normalizePermissions(before.permissions)
  const afterPermissions = normalizePermissions(after.permissions)
  if (!samePermissions(beforePermissions, afterPermissions)) {
    result.permissions = { before: beforePermissions, after: afterPermissions }
  }
  return result
}
