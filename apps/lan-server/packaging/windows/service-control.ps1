param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Install','Start','Stop','Restart','Uninstall')]
  [string]$Action,
  [string]$PackageDir = (Split-Path $PSScriptRoot -Parent),
  [string]$ProgramDataRoot = (Join-Path $env:ProgramData 'ArtiSys\Obra na Mão Server'),
  [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$serviceName = 'ObraNaMaoServer'
$wrapper = Join-Path $PackageDir 'platform\ObraNaMaoServer.exe'
$template = Join-Path $PackageDir 'platform\server.env.template'
if (-not $ConfigPath) { $ConfigPath = Join-Path $ProgramDataRoot 'config\server.env' }

function Invoke-Wrapper([string]$Command) {
  if (-not (Test-Path $wrapper)) { throw "WinSW não encontrado: $wrapper" }
  & $wrapper $Command
  if ($LASTEXITCODE -ne 0) { throw "WinSW $Command falhou com exit code $LASTEXITCODE" }
}

function Ensure-PersistentPaths {
  $configDir = Split-Path $ConfigPath -Parent
  $paths = @($configDir, (Join-Path $ProgramDataRoot 'data'), (Join-Path $ProgramDataRoot 'backups'), (Join-Path $ProgramDataRoot 'logs'))
  foreach ($path in $paths) { New-Item -ItemType Directory -Force -Path $path | Out-Null }
  if (-not (Test-Path $ConfigPath)) {
    if (-not (Test-Path $template)) { throw "Template de configuração ausente: $template" }
    Copy-Item $template $ConfigPath
  }
  # SID S-1-5-19 = NT AUTHORITY\LocalService; evita depender do idioma do Windows.
  foreach ($path in $paths) {
    & icacls $path /grant '*S-1-5-19:(OI)(CI)M' /T /C | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Falha ao conceder ACL LocalService em $path" }
  }
}

function Read-ServiceEnvironment {
  $entries = @()
  foreach ($line in Get-Content $ConfigPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $pair = $trimmed.Split('=', 2)
    if ($pair.Count -ne 2 -or -not $pair[0]) { throw "Linha inválida em ${ConfigPath}: $line" }
    $value = [Environment]::ExpandEnvironmentVariables($pair[1])
    $entries += "$($pair[0])=$value"
  }
  return $entries
}

function Set-ServiceEnvironment {
  $registryPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
  if (-not (Test-Path $registryPath)) { throw "Serviço $serviceName não registrado." }
  $entries = Read-ServiceEnvironment
  New-ItemProperty -Path $registryPath -Name Environment -PropertyType MultiString -Value $entries -Force | Out-Null
}

switch ($Action) {
  'Install' {
    Ensure-PersistentPaths
    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existing) { Invoke-Wrapper 'stop'; Invoke-Wrapper 'uninstall' }
    Invoke-Wrapper 'install'
    # Defesa adicional: força explicitamente NT AUTHORITY\LocalService mesmo se o wrapper mudar defaults.
    & sc.exe config $serviceName obj= 'NT AUTHORITY\LocalService' password= '' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar conta LocalService.' }
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
    # Intencionalmente não remove ProgramData, config, DB, backups ou logs.
  }
}
