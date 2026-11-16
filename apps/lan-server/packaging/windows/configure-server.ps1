$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $launcher = '"' + $PSCommandPath + '"'
  Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcher) -Verb RunAs
  exit
}
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = Join-Path $root 'runtime\node.exe'
$configurator = Join-Path $root 'app\src\configurator.mjs'
if (-not (Test-Path $node) -or -not (Test-Path $configurator)) {
  throw 'Arquivos do configurador não encontrados. Reinstale o Obra na Mão Server.'
}
Write-Host 'Abrindo configurador seguro do Obra na Mão Server...' -ForegroundColor Cyan
& $node $configurator
if ($LASTEXITCODE -ne 0) { throw "O configurador foi encerrado com código $LASTEXITCODE." }
