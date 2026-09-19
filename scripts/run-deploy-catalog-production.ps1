param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$deployScript = Join-Path $PSScriptRoot 'deploy-catalog-production.ps1'
if (-not (Test-Path $deployScript)) { throw "Script de deploy ausente: $deployScript" }
if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA nao esta definido; nao e seguro escolher workspace automaticamente.' }

$workspaceRoot = Join-Path $env:LOCALAPPDATA 'ArtiSysDeploy'
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null

$rootItem = Get-Item $workspaceRoot -Force
if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "Workspace temporario nao pode ser junction/symlink: $workspaceRoot"
}

Write-Host "Workspace temporario seguro: $workspaceRoot"
& $deployScript -WorkspaceRoot $workspaceRoot
exit $LASTEXITCODE
