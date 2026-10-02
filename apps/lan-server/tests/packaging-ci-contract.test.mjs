import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const workflowPath = path.resolve(import.meta.dirname, '../../../.github/workflows/server-platform-ci.yml')
const workflow = () => fs.readFileSync(workflowPath, 'utf8')

test('server platform CI has independent Windows and Linux jobs with read-only permissions', () => {
  const yaml = workflow()
  assert.match(yaml, /^permissions:\s*\n\s+contents:\s*read$/m)
  assert.match(yaml, /^\s{2}windows:\s*$/m)
  assert.match(yaml, /^\s{2}linux:\s*$/m)
  assert.match(yaml, /runs-on:\s*windows-latest/i)
  assert.match(yaml, /runs-on:\s*ubuntu-latest/i)
  assert.doesNotMatch(yaml, /contents:\s*write/i)
})

test('both packaging jobs run LAN tests before building platform artifacts', () => {
  const yaml = workflow()
  const windowsStart = yaml.indexOf('  windows:')
  const linuxStart = yaml.indexOf('  linux:')
  assert.ok(windowsStart >= 0 && linuxStart > windowsStart)
  const windowsBlock = yaml.slice(windowsStart, linuxStart)
  const linuxBlock = yaml.slice(linuxStart)
  for (const block of [windowsBlock, linuxBlock]) {
    const testsAt = block.indexOf('npm --prefix apps/lan-server test')
    const buildAt = Math.max(block.indexOf('packaging/windows/build.ps1'), block.indexOf('packaging/linux/build.sh'))
    assert.ok(testsAt >= 0, 'LAN tests missing from packaging job')
    assert.ok(buildAt > testsAt, 'platform build must happen after LAN tests')
  }
})

test('Windows CI exercises install, readiness, restart, reinstall and non-destructive uninstall', () => {
  const yaml = workflow()
  assert.match(yaml, /Obra-na-Mao-Server-Setup/i)
  assert.match(yaml, /\/ready/i)
  assert.match(yaml, /Restart-Service\s+ObraNaMaoServer/i)
  assert.match(yaml, /sentinel/i)
  assert.match(yaml, /unins000\.exe/i)
  assert.match(yaml, /ProgramData/i)
})

test('Linux CI exercises real systemd lifecycle and persistence', () => {
  const yaml = workflow()
  assert.match(yaml, /systemd-analyze\s+verify/i)
  assert.match(yaml, /systemctl\s+is-active/i)
  assert.match(yaml, /systemctl\s+restart\s+obra-na-mao-server\.service/i)
  assert.match(yaml, /packaging\/linux\/install\.sh/i)
  assert.match(yaml, /packaging\/linux\/uninstall\.sh/i)
  assert.match(yaml, /sentinel/i)
})

test('server platform CI uploads artifacts but never publishes or deploys', () => {
  const yaml = workflow()
  assert.match(yaml, /actions\/upload-artifact@v4/i)
  assert.doesNotMatch(yaml, /gh\s+release|create-release|softprops\/action-gh-release|deploy/i)
  assert.doesNotMatch(yaml, /DESKTOP_AUTO_RELEASE_ENABLED:\s*['"]?true/i)
})
