param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Install','Uninstall')]
  [string]$Action,
  [string]$InstallDir = (Split-Path $PSScriptRoot -Parent),
  [string]$ProgramDataRoot = (Join-Path $env:ProgramData 'ArtiSys\Obra na Mão Server'),
  [switch]$LanAccess,
  [int]$Port = 4732,
  [int]$ReadyTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$firewallRuleName = 'Obra na Mão Server (LAN)'
$ConfigPath = Join-Path $ProgramDataRoot 'config\server.env'
$templatePath = Join-Path $InstallDir 'platform\server.env.template'
$serviceControl = Join-Path $InstallDir 'platform\service-control.ps1'
$hookLogDir = Join-Path $ProgramDataRoot 'logs'
$hookLogPath = Join-Path $hookLogDir 'installer-hook.log'

function Write-HookLog([string]$Message) {
  New-Item -ItemType Directory -Force -Path $hookLogDir | Out-Null
  $stamp = (Get-Date).ToUniversalTime().ToString('o')
  Add-Content -Path $hookLogPath -Value "$stamp [$Action] $Message" -Encoding UTF8
}

function Get-ConfigValue([string]$Name, [string]$DefaultValue) {
  if (-not (Test-Path $ConfigPath)) { return $DefaultValue }
  foreach ($line in Get-Content $ConfigPath) {
    if ($line -match ('^' + [regex]::Escape($Name) + '=(.*)$')) {
      return [Environment]::ExpandEnvironmentVariables($Matches[1].Trim())
    }
  }
  return $DefaultValue
}

function Ensure-InitialConfig {
  New-Item -ItemType Directory -Force -Path (Split-Path $ConfigPath -Parent) | Out-Null
  if (-not (Test-Path $ConfigPath)) {
    if (-not (Test-Path $templatePath)) { throw "Template de configuração ausente: $templatePath" }
    Copy-Item $templatePath $ConfigPath
    if ($LanAccess) {
      $content = Get-Content $ConfigPath -Raw
      $content = $content -replace '(?m)^OBRA_NA_MAO_SERVER_HOST=127\.0\.0\.1$', 'OBRA_NA_MAO_SERVER_HOST=0.0.0.0'
      Set-Content -Path $ConfigPath -Value $content -Encoding utf8NoBOM
    }
  }
}

function Ensure-LanFirewall([int]$ConfiguredPort) {
  $existing = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
  if ($existing) { Remove-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue }
  New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $ConfiguredPort -RemoteAddress LocalSubnet -Profile Domain,Private | Out-Null
}

function Remove-ProductFirewall {
  if (Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
  }
}

function Wait-ServerReady([int]$ConfiguredPort) {
  $deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri "http://127.0.0.1:$ConfiguredPort/ready" -Method Get -TimeoutSec 2
      if ($response.ready -eq $true) { return }
    } catch {
      $lastError = $_
    }
    Start-Sleep -Milliseconds 250
  }
  $message = "Obra na Mão Server não ficou /ready em $ReadyTimeoutSeconds segundos."
  if ($lastError) { $message += " Último erro: $($lastError.Exception.Message)" }
  throw $message
}

try {
  Write-HookLog 'begin'
  switch ($Action) {
    'Install' {
      Ensure-InitialConfig
      $configuredPort = [int](Get-ConfigValue 'OBRA_NA_MAO_SERVER_PORT' ([string]$Port))
      $configuredHost = Get-ConfigValue 'OBRA_NA_MAO_SERVER_HOST' '127.0.0.1'

      Write-HookLog 'registering service'
      & $serviceControl -Action Install -PackageDir $InstallDir -ProgramDataRoot $ProgramDataRoot -ConfigPath $ConfigPath
      if ($LASTEXITCODE -ne 0) { throw 'Falha ao registrar o serviço Obra na Mão Server.' }

      if ($configuredHost -eq '0.0.0.0') { Ensure-LanFirewall $configuredPort }
      Write-HookLog 'starting service'
      & $serviceControl -Action Start -PackageDir $InstallDir -ProgramDataRoot $ProgramDataRoot -ConfigPath $ConfigPath
      if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o serviço Obra na Mão Server.' }
      Wait-ServerReady $configuredPort
      Write-HookLog 'ready'
    }
    'Uninstall' {
      if (Test-Path $serviceControl) {
        & $serviceControl -Action Uninstall -PackageDir $InstallDir -ProgramDataRoot $ProgramDataRoot -ConfigPath $ConfigPath
      }
      Remove-ProductFirewall
      Write-HookLog 'service and product firewall removed; persistent state preserved'
    }
  }
  Write-HookLog 'success'
  exit 0
} catch {
  Write-HookLog ("failed: " + $_.Exception.Message)
  Write-Error $_.Exception.Message
  exit 1
}
