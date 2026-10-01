import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const windowsDir = path.resolve(import.meta.dirname, '../packaging/windows')
const read = name => fs.readFileSync(path.join(windowsDir, name), 'utf8')

test('Inno installer is x64, uses Program Files and stops the service before binary replacement', () => {
  const iss = read('installer.iss')
  assert.match(iss, /DefaultDirName=.*autopf.*ArtiSys.*Obra na Mão Server/i)
  assert.match(iss, /ArchitecturesAllowed=.*x64/i)
  assert.match(iss, /ArchitecturesInstallIn64BitMode=.*x64/i)
  assert.match(iss, /PrepareToInstall/is)
  assert.match(iss, /preinstall-stop\.ps1/is)
  assert.match(iss, /Flags:[^\n]*dontcopy/is)
  assert.match(iss, /ExtractTemporaryFile\(['"]preinstall-stop\.ps1['"]\)/is)
  assert.match(iss, /install-hooks\.ps1/is)
  assert.match(iss, /UninstallRun/is)
  assert.doesNotMatch(iss, /-Command\s+\".*Stop-Service/is)
  assert.doesNotMatch(iss, /(DelTree|Remove-Item)[^\n]*ProgramData/i)

  const stopHook = read('preinstall-stop.ps1')
  assert.match(stopHook, /\$serviceName\s*=\s*['"]ObraNaMaoServer['"]/i)
  assert.match(stopHook, /Get-Service[^\n]*\$serviceName/i)
  assert.match(stopHook, /Stop-Service[^\n]*\$serviceName/i)
  assert.match(stopHook, /WaitForStatus/i)
})

test('LAN access is an unchecked opt-in task, never a default firewall opening', () => {
  const iss = read('installer.iss')
  assert.match(iss, /Name:\s*"lanaccess"/i)
  assert.match(iss, /Flags:\s*unchecked/i)
  const hooks = read('install-hooks.ps1')
  assert.match(hooks, /New-NetFirewallRule/i)
  assert.match(hooks, /LocalSubnet/i)
  assert.match(hooks, /Obra na Mão Server \(LAN\)/i)
  assert.match(hooks, /0\.0\.0\.0/)
  assert.match(hooks, /127\.0\.0\.1/)
})

test('first install creates config once; upgrades preserve existing config and persistent state', () => {
  const hooks = read('install-hooks.ps1')
  assert.match(hooks, /if\s*\(-not\s*\(Test-Path\s+\$ConfigPath\)\)/i)
  assert.match(hooks, /server\.env\.template/i)
  assert.match(hooks, /OBRA_NA_MAO_SERVER_HOST/i)
  assert.match(hooks, /service-control\.ps1/i)
  assert.match(hooks, /\/ready/i)
  assert.doesNotMatch(hooks, /Remove-Item[^\n]*(ProgramDataRoot|ConfigPath|\\data|\\backups)/i)
})

test('uninstall removes only service and product firewall rule, not ProgramData', () => {
  const hooks = read('install-hooks.ps1')
  assert.match(hooks, /Remove-NetFirewallRule/i)
  assert.match(hooks, /Obra na Mão Server \(LAN\)/i)
  assert.match(hooks, /Uninstall/i)
  assert.doesNotMatch(hooks, /Remove-Item[^\n]*ProgramDataRoot/i)
})

test('Windows build bootstraps pinned Inno Setup with checksum verification', () => {
  const build = read('build.ps1')
  assert.match(build, /innoSetup/i)
  assert.match(build, /7\.1\.0/)
  assert.match(build, /Get-VerifiedFile/i)
  assert.match(build, /ISCC\.exe/i)
  assert.match(build, /installer\.iss/i)
})
