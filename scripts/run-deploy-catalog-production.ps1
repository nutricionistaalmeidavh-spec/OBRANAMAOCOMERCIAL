param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA nao esta definido; nao e seguro escolher workspace automaticamente.' }

$workspaceRoot = Join-Path $env:LOCALAPPDATA 'ArtiSysDeploy'
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null

$rootItem = Get-Item $workspaceRoot -Force
if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "Workspace temporario nao pode ser junction/symlink: $workspaceRoot"
}

$deployScript = Join-Path $env:TEMP 'deploy-catalog-production-core.ps1'
$deployUrl = 'https://raw.githubusercontent.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/main/scripts/deploy-catalog-production.ps1'
Invoke-WebRequest $deployUrl -OutFile $deployScript

Write-Host "Workspace temporario seguro: $workspaceRoot"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deployScript -WorkspaceRoot $workspaceRoot
exit $LASTEXITCODE
