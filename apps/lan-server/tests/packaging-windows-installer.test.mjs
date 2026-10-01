import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const windowsDir = path.resolve(import.meta.dirname, '../packaging/windows')
const read = name => fs.readFileSync(path.join(windowsDir, name), 'utf8')

test('Inno installer is x64, stops the service before replacement and checks postinstall exit code', () => {
  const iss = read('installer.iss')
  assert.match(iss, /DefaultDirName=.*autopf.*ArtiSys.*Obra na Mão Server/i)
  assert.match(iss, /ArchitecturesAllowed=.*x64/i)
  assert.match(iss, /ArchitecturesInstallIn64BitMode=.*x64/i)
  assert.match(iss, /PrepareToInstall/is)
  assert.match(iss, /preinstall-stop\.ps1/is)
  assert.match(iss, /Flags:[^\n]*dontcopy/is)
  assert.match(iss, /ExtractTemporaryFile\(['"]preinstall-stop\.ps1['"]\)/is)
  assert.match(iss, /install-hooks\.ps1/is)
  assert.match(iss, /CurStepChanged\s*\(/is)
  assert.match(iss, /ssPostInstall/is)
  assert.match(iss, /ResultCode\s*<>\s*0/is)
  assert.match(iss, /function\s+GetCustomSetupExitCode\s*(?:\(\s*\))?\s*:\s*Integer/is)
  assert.match(iss, /PostInstallExitCode/is)
  assert.match(iss, /UninstallRun/is)
  assert.doesNotMatch(iss, /^\[Run\]/m)
  assert.doesNotMatch(iss, /-Command\s+\".*Stop-Service/is)
  assert.doesNotMatch(iss, /(DelTree|Remove-Item)[^\n]*ProgramData/i)

  const stopHook = read('preinstall-stop.ps1')
  assert.match(stopHook, /\$serviceName\s*=\s*['"]ObraNaMaoServer['"]/i)
  assert.match(stopHook, /Get-Service[^\n]*\$serviceName/i)
  assert.match(stopHook, /Stop-Service[^\n]*\$serviceName/i)
  assert.match(stopHook, /WaitForStatus/i)
})

test('PowerShell lifecycle never evaluates PSScriptRoot inside parameter defaults or passes a Program Files script path through -File', () => {
  const iss = read('installer.iss')
  const hooks = read('install-hooks.ps1')

  assert.match(hooks, /\[string\]\$InstallDir\s*(?:,|\r?\n)/i)
  assert.doesNotMatch(hooks, /\[string\]\$InstallDir\s*=\s*\(Split-Path\s+\$PSScriptRoot\s+-Parent\)/i)
  assert.match(hooks, /if\s*\(\s*-not\s+\$InstallDir\s*\)\s*\{\s*\$InstallDir\s*=\s*Split-Path\s+\$PSScriptRoot\s+-Parent\s*\}/is)
  assert.match(iss, /PlatformDir\s*:=\s*ExpandConstant\(['"]\{app\}\\platform['"]\)/i)
  assert.match(iss, /Params\s*:=\s*['"]-NoProfile\s+-ExecutionPolicy\s+Bypass\s+-File\s+install-hooks\.ps1\s+-Action\s+Install/i)
  assert.match(iss, /Exec\s*\(\s*PowerShellPath\s*,\s*Params\s*,\s*PlatformDir\s*,/is)
  assert.doesNotMatch(iss, /-File\s+['"]?\{app\}\\platform\\install-hooks\.ps1/i)

  const uninstallLine = iss.split(/\r?\n/).find(line => /^Filename:.*powershell\.exe/i.test(line) && /Uninstall/i.test(line)) ?? ''
  assert.match(uninstallLine, /WorkingDir:\s*"\{app\}\\platform"/i)
  assert.match(uninstallLine, /-File\s+install-hooks\.ps1\s+-Action\s+Uninstall/i)
  assert.doesNotMatch(uninstallLine, /-InstallDir/i)
})

test('Windows install hook records sanitized operational progress and failures', () => {
  const hooks = read('install-hooks.ps1')
  assert.match(hooks, /installer-hook\.log/i)
  assert.match(hooks, /Write-HookLog/i)
  assert.match(hooks, /catch\s*\{/i)
  assert.match(hooks, /Exception\.Message/i)
  assert.doesNotMatch(hooks, /setupCode|pairingCode|bearer|deviceToken|serverToken/i)
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
