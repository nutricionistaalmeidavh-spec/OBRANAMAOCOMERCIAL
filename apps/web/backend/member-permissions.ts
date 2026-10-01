export const PERMISSION_DOMAINS = ['core', 'operation', 'planning', 'finance', 'rh'] as const
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'] as const

export type PermissionDomain = typeof PERMISSION_DOMAINS[number]
export type PermissionAction = typeof PERMISSION_ACTIONS[number]
export type PermissionMatrix = Record<PermissionDomain, PermissionAction[]>
export type MemberRole = 'admin' | 'foreman' | 'employee'

const ALL_ACTIONS = [...PERMISSION_ACTIONS]
const EMPTY_MATRIX = (): PermissionMatrix => ({ core: [], operation: [], planning: [], finance: [], rh: [] })

const ROLE_TEMPLATES: Record<MemberRole, PermissionMatrix> = {
  admin: {
    core: [...ALL_ACTIONS],
    operation: [...ALL_ACTIONS],
    planning: [...ALL_ACTIONS],
    finance: [...ALL_ACTIONS],
    rh: [...ALL_ACTIONS]
  },
  foreman: {
    core: ['view', 'create', 'edit'],
    operation: ['view', 'create', 'edit', 'approve'],
    planning: ['view', 'edit'],
    finance: [],
    rh: []
  },
  employee: {
    core: ['view'],
    operation: ['view', 'create'],
    planning: ['view'],
    finance: [],
    rh: []
  }
}

const DOMAIN_MODULES: Record<PermissionDomain, string[]> = {
  core: ['obra360'],
  operation: ['obra360', 'rdo'],
  planning: ['obra360'],
  finance: ['finance', 'dre'],
  rh: ['rh']
}

function intersect(left: string[] = [], right: string[] = []) {
  const allowed = new Set(right.map(String))
  return left.map(String).filter(value => allowed.has(value))
}

function normalizeActions(value: unknown): PermissionAction[] {
  const supplied = Array.isArray(value) ? new Set(value.map(String)) : new Set<string>()
  return PERMISSION_ACTIONS.filter(action => supplied.has(action))
}

export function normalizePermissions(value: unknown): PermissionMatrix {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  return Object.fromEntries(PERMISSION_DOMAINS.map(domain => [domain, normalizeActions(source[domain])])) as PermissionMatrix
}

export function roleTemplate(role: MemberRole): PermissionMatrix {
  const template = ROLE_TEMPLATES[role] || ROLE_TEMPLATES.employee
  return Object.fromEntries(PERMISSION_DOMAINS.map(domain => [domain, [...template[domain]]])) as PermissionMatrix
}

function moduleActionCap(domain: PermissionDomain, modules: string[]): PermissionAction[] {
  if (domain === 'finance' && !modules.includes('finance') && modules.includes('dre')) return ['view']
  return DOMAIN_MODULES[domain].some(module => modules.includes(module)) ? [...ALL_ACTIONS] : []
}

export function effectivePermissions(input: {
  role: MemberRole
  customPermissions?: unknown
  modules?: string[]
  channels?: string[]
  companyModules?: string[]
  companyChannels?: string[]
}): PermissionMatrix {
  const effectiveChannels = intersect(input.channels || [], input.companyChannels || [])
  if (!effectiveChannels.includes('desktop')) return EMPTY_MATRIX()

  const effectiveModules = intersect(input.modules || [], input.companyModules || [])
  const requested = input.customPermissions === undefined
    ? roleTemplate(input.role)
    : normalizePermissions(input.customPermissions)
  const matrix = EMPTY_MATRIX()

  for (const domain of PERMISSION_DOMAINS) {
    const cap = new Set(moduleActionCap(domain, effectiveModules))
    matrix[domain] = requested[domain].filter(action => cap.has(action))
  }
  return matrix
}

function fnv1a(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function permissionsRevision(matrix: PermissionMatrix): string {
  const normalized = normalizePermissions(matrix)
  const canonical = JSON.stringify(PERMISSION_DOMAINS.map(domain => [domain, normalized[domain]]))
  return `perm-v1-${fnv1a(canonical)}`
}
