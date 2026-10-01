import {
  PERMISSION_ACTIONS,
  PERMISSION_DOMAINS,
  effectivePermissions,
  normalizePermissions,
  permissionsRevision,
  roleTemplate,
  type MemberRole,
  type PermissionAction,
  type PermissionDomain,
  type PermissionMatrix
} from '../backend/member-permissions'

const DOMAIN_LABELS: Record<PermissionDomain, string> = {
  core: 'Cadastros',
  operation: 'Operação/RDO',
  planning: 'Planejamento',
  finance: 'Financeiro',
  rh: 'RH'
}

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Ver',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  approve: 'Aprovar'
}

export function permissionMatrixRows() {
  return PERMISSION_DOMAINS.map(domain => ({
    domain,
    label: DOMAIN_LABELS[domain],
    actions: PERMISSION_ACTIONS.map(action => ({
      action,
      label: ACTION_LABELS[action],
      inputType: 'checkbox' as const
    }))
  }))
}

export function editorPermissionMatrix(role: MemberRole, storedPermissions?: unknown): PermissionMatrix {
  return storedPermissions === undefined || storedPermissions === null
    ? roleTemplate(role)
    : normalizePermissions(storedPermissions)
}

export function isCustomPermissionMatrix(role: MemberRole, matrix: unknown): boolean {
  return permissionsRevision(normalizePermissions(matrix)) !== permissionsRevision(roleTemplate(role))
}

export function governancePermissionState(input: {
  role: MemberRole
  storedPermissions?: unknown
  modules?: string[]
  channels?: string[]
  companyModules?: string[]
  companyChannels?: string[]
}) {
  const selected = editorPermissionMatrix(input.role, input.storedPermissions)
  const effective = effectivePermissions({
    role: input.role,
    customPermissions: selected,
    modules: input.modules || [],
    channels: input.channels || [],
    companyModules: input.companyModules || [],
    companyChannels: input.companyChannels || []
  })
  const memberChannels = new Set((input.channels || []).map(String))
  const companyChannels = new Set((input.companyChannels || []).map(String))
  const desktopEnabled = memberChannels.has('desktop') && companyChannels.has('desktop')
  const blockedDomains = PERMISSION_DOMAINS.filter(domain => {
    const selectedActions = selected[domain]
    const effectiveActions = new Set(effective[domain])
    return selectedActions.some(action => !effectiveActions.has(action))
  })
  return {
    selected,
    effective,
    customized: isCustomPermissionMatrix(input.role, selected),
    desktopEnabled,
    blockedDomains
  }
}
