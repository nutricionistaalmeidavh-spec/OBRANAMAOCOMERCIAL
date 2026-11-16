$ErrorActionPreference = 'Stop'
$platform = $PSScriptRoot
$root = Split-Path $platform -Parent
$node = Join-Path $root 'runtime\node.exe'
$wizard = Join-Path $platform 'config-wizard.mjs'
if (-not (Test-Path $node) -or -not (Test-Path $wizard)) { throw 'Obra na Mão Server precisa estar instalado antes de configurar.' }
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'))
  exit
}
& $node $wizard --open
if ($LASTEXITCODE -ne 0) { throw "O configurador terminou com código $LASTEXITCODE." }