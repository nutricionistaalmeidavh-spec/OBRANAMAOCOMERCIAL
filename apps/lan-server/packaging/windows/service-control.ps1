param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Install','Start','Stop','Restart','Uninstall')]
  [string]$Action,
  [string]$PackageDir = (Split-Path $PSScriptRoot -Parent),
  [string]$ProgramDataRoot,
  [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$serviceName = 'ObraNaMaoServer'
$productDirName = "Obra na M$([char]0x00E3)o Server"
if (-not $ProgramDataRoot) {
  $ProgramDataRoot = Join-Path $env:ProgramData (Join-Path 'ArtiSys' $productDirName)
}
$wrapper = Join-Path $PackageDir 'platform\ObraNaMaoServer.exe'
$template = Join-Path $PackageDir 'platform\server.env.template'
if (-not $ConfigPath) { $ConfigPath = Join-Path $ProgramDataRoot 'config\server.env' }

function Invoke-Wrapper([string]$Command) {
  if (-not (Test-Path $wrapper)) { throw "WinSW not found: $wrapper" }
  & $wrapper $Command
  if ($LASTEXITCODE -ne 0) { throw "WinSW $Command failed with exit code $LASTEXITCODE" }
}

function Ensure-PersistentPaths {
  $configDir = Split-Path $ConfigPath -Parent
  $paths = @($configDir, (Join-Path $ProgramDataRoot 'data'), (Join-Path $ProgramDataRoot 'backups'), (Join-Path $ProgramDataRoot 'logs'))
  foreach ($path in $paths) { New-Item -ItemType Directory -Force -Path $path | Out-Null }
  if (-not (Test-Path $ConfigPath)) {
    if (-not (Test-Path $template)) { throw "Missing configuration template: $template" }
    Copy-Item $template $ConfigPath
  }
  foreach ($path in $paths) {
    & icacls $path /grant '*S-1-5-19:(OI)(CI)M' /T /C | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to grant LocalService ACL on $path" }
  }
}

function Read-ServiceEnvironment {
  $entries = @()
  foreach ($line in Get-Content $ConfigPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $pair = $trimmed.Split('=', 2)
    if ($pair.Count -ne 2 -or -not $pair[0]) { throw "Invalid line in ${ConfigPath}: $line" }
    $value = [Environment]::ExpandEnvironmentVariables($pair[1])
    $entries += "$($pair[0])=$value"
  }
  return $entries
}

function Set-ServiceEnvironment {
  $registryPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
  if (-not (Test-Path $registryPath)) { throw "Service $serviceName is not registered." }
  $entries = Read-ServiceEnvironment
  New-ItemProperty -Path $registryPath -Name Environment -PropertyType MultiString -Value $entries -Force | Out-Null
}

switch ($Action) {
  'Install' {
    Ensure-PersistentPaths
    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existing) { Invoke-Wrapper 'stop'; Invoke-Wrapper 'uninstall' }
    Invoke-Wrapper 'install'
    & sc.exe config $serviceName obj= 'NT AUTHORITY\LocalService' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Failed to configure LocalService account.' }
    Set-ServiceEnvironment
  }
  'Start' { Invoke-Wrapper 'start' }
  'Stop' {
    if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) { Invoke-Wrapper 'stop' }
  }
  'Restart' { Invoke-Wrapper 'restart' }
  'Uninstall' {
    if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
      try { Invoke-Wrapper 'stop' } catch { Write-Warning $_ }
      Invoke-Wrapper 'uninstall'
    }
  }
}
