import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const desktop = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'))

describe('Windows upgrade preserves canonical files', () => {
  it('uses a non-destructive install section even when upgrading a legacy uninstaller', () => {
    expect(pkg.build.nsis.include).toBe('build/preserve-data.nsh')
    const section = fs.readFileSync(path.join(desktop, 'build/installSection.nsh'), 'utf8')
    expect(section).not.toMatch(/^\s*!insertmacro\s+uninstallOldVersion/im)
    expect(section).not.toMatch(/^\s*(?:RMDir|Delete)\s/im)
    expect(section).toMatch(/!insertmacro installApplicationFiles/)
    expect(section).toMatch(/!insertmacro registryAddInstallInfo/)
  })

  it('replaces stale shortcuts and launches the just-installed executable', () => {
    expect(pkg.build.nsis.include).toBe('build/preserve-data.nsh')
    const section = fs.readFileSync(path.join(desktop, 'build/installSection.nsh'), 'utf8')
    expect(section).toContain('StrCpy $keepShortcuts "false"')
    expect(section).toContain('!insertmacro addStartMenuLink $keepShortcuts')
    expect(section).toContain('!insertmacro addDesktopLink $keepShortcuts')
    expect(section).toContain('StrCpy $launchLink "$appExe"')
  })
})
