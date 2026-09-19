param(
  [string]$WorkspaceRoot = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'ArtiSysMigrationRepair' } else { '' })
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoUrl = 'https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL.git'
$productionBase = 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev'
$databaseName = 'obra-na-mao-comercial'
$allowedLegacyMigrations = @(
  '0002_versioning_observability.sql',
  '0003_schema_contract_hardening.sql'
)

function Get-OptionalProperty($Object, [string]$Name) {
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Invoke-Native([string]$File, [string[]]$Arguments) {
  Write-Host ('RUN: {0} {1}' -f $File, ($Arguments -join ' '))
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ($LASTEXITCODE): $File $($Arguments -join ' ')"
  }
}

function Get-Health {
  $url = "$productionBase/api/health?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Write-Host "HEALTH: $url"
  return Invoke-RestMethod -Uri $url -Method Get -Headers @{ 'cache-control' = 'no-cache' }
}

if (-not $WorkspaceRoot) { throw 'LOCALAPPDATA indisponivel; abortando para nao usar workspace ambiguo.' }
New-Item -ItemType Directory -Path $WorkspaceRoot -Force | Out-Null
$rootItem = Get-Item $WorkspaceRoot -Force
if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "Workspace de manutencao nao pode ser junction/symlink: $WorkspaceRoot"
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$workspace = Join-Path $WorkspaceRoot "tracking-$stamp"
$repoDir = Join-Path $workspace 'OBRANAMAOCOMERCIAL'
New-Item -ItemType Directory -Path $workspace -Force | Out-Null

Write-Host '=== PRE-FLIGHT: somente leitura ==='
Invoke-Native 'git.exe' @('--version')
Invoke-Native 'node.exe' @('--version')
Invoke-Native 'npx.cmd' @('-y','wrangler@4','whoami')
Invoke-Native 'git.exe' @('clone','--depth','1','--branch','main','--single-branch',$repoUrl,$repoDir)

$healthBefore = Get-Health
$ok = [bool](Get-OptionalProperty $healthBefore 'ok')
$schemaReady = [bool](Get-OptionalProperty $healthBefore 'schemaReady')
$expectedSchema = [int](Get-OptionalProperty $healthBefore 'expectedDbSchemaVersion')
$persistedSchema = [int](Get-OptionalProperty $healthBefore 'persistedDbSchemaVersion')
$trackingReady = [bool](Get-OptionalProperty $healthBefore 'migrationTrackingReady')
$missing = @((Get-OptionalProperty $healthBefore 'missingRequiredMigrations')) | Where-Object { $_ }

if (-not $ok) { throw 'Produção não está saudável; nenhuma alteração de tracking será feita.' }
if (-not $schemaReady) { throw 'Schema de produção não está pronto; nenhuma alteração de tracking será feita.' }
if ($expectedSchema -ne $persistedSchema) { throw "Versão de schema divergente (expected=$expectedSchema persisted=$persistedSchema); abortando." }
if ($trackingReady) {
  Write-Host 'Migration tracking já está regularizado. Nenhuma alteração necessária.'
  exit 0
}
if ($missing.Count -eq 0) { throw 'Tracking não está pronto, mas a API não informou migrations faltantes; abortando.' }

$unexpected = @($missing | Where-Object { $_ -notin $allowedLegacyMigrations })
if ($unexpected.Count -gt 0) {
  throw "Há migrations faltantes fora da allowlist segura: $($unexpected -join ', ')"
}

Write-Host "Schema saudável na versão $persistedSchema. Gaps permitidos: $($missing -join ', ')"

$webDir = Join-Path $repoDir 'apps\web'
Push-Location $webDir
try {
  Write-Host '=== VALIDAR TABELA DE TRACKING: somente leitura ==='
  Invoke-Native 'npx.cmd' @('-y','wrangler@4','d1','execute',$databaseName,'--remote','--config','wrangler.jsonc','--command','SELECT id,name,applied_at FROM d1_migrations ORDER BY id;')

  $values = @($missing | ForEach-Object { "('" + ($_ -replace "'", "''") + "')" }) -join ','
  $sql = "INSERT OR IGNORE INTO d1_migrations(name) VALUES $values;"

  Write-Host '=== MUTACAO CONTROLADA: somente metadata do Wrangler ==='
  Write-Host "Registrando: $($missing -join ', ')"
  Invoke-Native 'npx.cmd' @('-y','wrangler@4','d1','execute',$databaseName,'--remote','--config','wrangler.jsonc','--command',$sql)

  Write-Host '=== VALIDACAO POS-AJUSTE ==='
  Invoke-Native 'npx.cmd' @('-y','wrangler@4','d1','migrations','list',$databaseName,'--remote','--config','wrangler.jsonc')
} finally {
  Pop-Location
}

Start-Sleep -Seconds 2
$healthAfter = Get-Health
$afterOk = [bool](Get-OptionalProperty $healthAfter 'ok')
$afterSchemaReady = [bool](Get-OptionalProperty $healthAfter 'schemaReady')
$afterTrackingReady = [bool](Get-OptionalProperty $healthAfter 'migrationTrackingReady')
$afterExpected = [int](Get-OptionalProperty $healthAfter 'expectedDbSchemaVersion')
$afterPersisted = [int](Get-OptionalProperty $healthAfter 'persistedDbSchemaVersion')
$afterMissing = @((Get-OptionalProperty $healthAfter 'missingRequiredMigrations')) | Where-Object { $_ }

if (-not $afterOk -or -not $afterSchemaReady) { throw 'Health pós-ajuste não permaneceu saudável.' }
if ($afterExpected -ne $expectedSchema -or $afterPersisted -ne $persistedSchema) {
  throw 'A versão de schema mudou inesperadamente durante o reparo; verificar produção.'
}
if (-not $afterTrackingReady -or $afterMissing.Count -gt 0) {
  throw "Tracking ainda incompleto após o ajuste: $($afterMissing -join ', ')"
}

$env:PRODUCTION_URL = $productionBase
Remove-Item Env:EXPECTED_SHA -ErrorAction SilentlyContinue
Invoke-Native 'node.exe' @((Join-Path $repoDir 'apps\web\scripts\smoke-production.mjs'))

Write-Host '=== MIGRATION TRACKING REGULARIZADO COM SUCESSO ==='
Write-Host "Schema permaneceu na versão $afterPersisted."
Write-Host 'Nenhuma migration SQL foi reaplicada e nenhuma tabela/dado de negócio foi alterado.'
Write-Host "Workspace: $workspace"
