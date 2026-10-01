import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(path.resolve(import.meta.dirname, 'admin-governance.ts'), 'utf8')

describe('admin governance granular permissions UI contract', () => {
  it('uses the shared granular permission editor model', () => {
    expect(source).toContain("from './admin-governance-permissions'")
    expect(source).toContain('permissionMatrixRows')
    expect(source).toContain('governancePermissionState')
  })

  it('extends the member payload with stored and effective permission metadata', () => {
    expect(source).toContain('permissions?:PermissionMatrix')
    expect(source).toContain('effectivePermissions?:PermissionMatrix')
    expect(source).toContain('permissionsRevision?:string')
  })

  it('renders independent domain × action checkboxes and posts the selected matrix', () => {
    expect(source).toContain('data-gov-permission')
    expect(source).toContain('permissionSelection')
    expect(source).toMatch(/api\.post\('\/api\/members',\{[^}]*permissions/s)
  })

  it('does not silently overwrite custom permissions when role changes', () => {
    expect(source).not.toContain("role.addEventListener('change',()=>{toggleEmployee();applyDefaults")
    expect(source).toContain('Aplicar padrão do papel')
  })

  it('shows effective/blocked state so licensed limits are visible before save', () => {
    expect(source).toContain('Permissões efetivas')
    expect(source).toContain('blockedDomains')
    expect(source).toContain('Personalizado')
  })
})
