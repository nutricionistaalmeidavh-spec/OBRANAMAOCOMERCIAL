param(
  [string]$WorkspaceRoot = 'C:\VICTOR\ArtiSysDeploy'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$mlRepo = 'https://github.com/nutricionistaalmeidavh-spec/MercadoLivre.git'
$obraRepo = 'https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL.git'
$mlBase = 'https://artisys-mercadolivre.nutricionistaalmeidavh.workers.dev'
$obraBase = 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$workspace = Join-Path $WorkspaceRoot "catalog-prod-$stamp"
$mlDir = Join-Path $workspace 'MercadoLivre'
$obraDir = Join-Path $workspace 'OBRANAMAOCOMERCIAL'
$logPath = Join-Path $workspace 'deploy.log'
$mlDeployed = $false
$obraDeployed = $false
$mlConfig = $null

function Write-Step([string]$Message) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $Message"
  Write-Host $line
  Add-Content -Path $logPath -Value $line -Encoding UTF8
}

function Invoke-Native([string]$File, [string[]]$Arguments) {
  Write-Step ("RUN: {0} {1}" -f $File, ($Arguments -join ' '))
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $File @Arguments 2>&1 | Tee-Object -FilePath $logPath -Append | ForEach-Object { Write-Host $_ }
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    $tail = (Get-Content $logPath -Tail 30 -ErrorAction SilentlyContinue) -join "`n"
    throw "Falha ($exitCode): $File $($Arguments -join ' ')`n--- ultimas linhas ---`n$tail"
  }
}

function Invoke-NativeCapture([string]$File, [string[]]$Arguments) {
  Write-Step ("RUN: {0} {1}" -f $File, ($Arguments -join ' '))
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = & $File @Arguments
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw "Falha ($exitCode): $File $($Arguments -join ' ')"
  }
  $text = ($output -join "`n")
  if ($text) { Add-Content -Path $logPath -Value $text -Encoding UTF8 }
  return $text
}

function Assert-HttpOk([string]$Url) {
  Write-Step "HTTP: $Url"
  $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Headers @{ 'cache-control' = 'no-cache' }
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "HTTP $($response.StatusCode): $Url"
  }
  return $response
}

function Get-OptionalProperty($Object, [string]$Name) {
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Test-PropertyExists($Object, [string]$Name) {
  if ($null -eq $Object) { return $false }
  return $null -ne $Object.PSObject.Properties[$Name]
}

function Rollback-Worker([string]$Directory, [string]$Config, [string]$Name) {
  try {
    Push-Location $Directory
    Write-Step "ROLLBACK: $Name"
    & npx.cmd -y wrangler@4 rollback --yes --config $Config --message "ArtiSys automatic rollback after failed catalog production smoke"
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Rollback de $Name retornou exit code $LASTEXITCODE. Verifique Cloudflare imediatamente."
    }
  } catch {
    Write-Warning "Rollback de $Name falhou: $($_.Exception.Message)"
  } finally {
    Pop-Location
  }
}

New-Item -ItemType Directory -Path $workspace -Force | Out-Null
New-Item -ItemType File -Path $logPath -Force | Out-Null

try {
  Write-Step '=== PRE-FLIGHT ==='
  Invoke-Native 'git.exe' @('--version')
  Invoke-Native 'node.exe' @('-e', "const [a,b]=process.versions.node.split('.').map(Number); if(a!==22 || b<12){console.error('Node 22.12+ e <23 obrigatorio; atual='+process.versions.node); process.exit(1)} console.log('Node '+process.versions.node)")
  Invoke-Native 'npm.cmd' @('--version')
  Invoke-Native 'npx.cmd' @('-y','wrangler@4','whoami')

  Write-Step 'Clonando somente main dos dois repositorios em workspace limpo.'
  Invoke-Native 'git.exe' @('clone','--depth','1','--branch','main','--single-branch',$mlRepo,$mlDir)
  Invoke-Native 'git.exe' @('clone','--depth','1','--branch','main','--single-branch',$obraRepo,$obraDir)

  $mlSha = (Invoke-NativeCapture 'git.exe' @('-C',$mlDir,'rev-parse','HEAD')).Trim()
  $obraSha = (Invoke-NativeCapture 'git.exe' @('-C',$obraDir,'rev-parse','HEAD')).Trim()
  Write-Step "MercadoLivre main: $mlSha"
  Write-Step "OBRANAMAOCOMERCIAL main: $obraSha"

  Write-Step '=== FASE 1: QA LOCAL COMPLETO - NENHUMA MUTACAO DE PRODUCAO AINDA ==='

  Write-Step '=== MERCADO LIVRE: QA LOCAL ==='
  Push-Location $mlDir
  Write-Step 'MercadoLivre nao possui package-lock; usando o mesmo npm install do CI oficial.'
  Invoke-Native 'npm.cmd' @('install','--no-audit','--no-fund')
  Invoke-Native 'npm.cmd' @('run','check')
  Invoke-Native 'npm.cmd' @('test')
  Pop-Location

  Write-Step '=== OBRA NA MAO COMERCIAL: QA LOCAL EM CLONE LIMPO ==='
  Push-Location $obraDir
  Invoke-Native 'npm.cmd' @('--prefix','apps/web','ci','--no-audit','--no-fund')
  Invoke-Native 'npm.cmd' @('--prefix','apps/web','run','catalog:verify')
  Invoke-Native 'npm.cmd' @('--prefix','apps/web','test')
  Invoke-Native 'npm.cmd' @('--prefix','apps/web','run','ux:verify')
  Invoke-Native 'npm.cmd' @('--prefix','apps/web','run','build')
  Pop-Location

  Write-Step 'QA LOCAL COMPLETO: PASS. A partir daqui o script pode alterar producao.'
  Write-Step '=== FASE 2: PREPARAR E PUBLICAR MERCADO LIVRE ==='

  Push-Location $mlDir
  Write-Step 'Resolvendo o D1 artisys-mercadolivre pelo nome.'
  $d1Json = Invoke-NativeCapture 'npx.cmd' @('-y','wrangler@4','d1','list','--json')
  $dbs = $d1Json | ConvertFrom-Json
  $db = @($dbs) | Where-Object { (Get-OptionalProperty $_ 'name') -eq 'artisys-mercadolivre' } | Select-Object -First 1
  if (-not $db) { throw 'D1 artisys-mercadolivre nao encontrado na conta Cloudflare autenticada.' }
  $dbId = [string](Get-OptionalProperty $db 'uuid')
  if (-not $dbId) { $dbId = [string](Get-OptionalProperty $db 'id') }
  if (-not $dbId) { throw 'D1 artisys-mercadolivre encontrado, mas sem uuid/id.' }
  Write-Step "D1 localizado: $($dbId.Substring(0,[Math]::Min(8,$dbId.Length)))..."

  $templateConfig = Join-Path $mlDir 'cloudflare\wrangler.jsonc'
  $mlConfig = Join-Path $mlDir 'cloudflare\wrangler.production.jsonc'
  $configText = Get-Content $templateConfig -Raw
  if ($configText -notmatch 'REPLACE_WITH_D1_DATABASE_ID') {
    Write-Step 'wrangler.jsonc ja possui database_id real; usando copia de producao sem substituicao.'
  } else {
    $configText = $configText.Replace('REPLACE_WITH_D1_DATABASE_ID', $dbId)
  }
  Set-Content -Path $mlConfig -Value $configText -Encoding UTF8

  Write-Step 'Aplicando migrations remotas do Mercado Livre.'
  Invoke-Native 'npx.cmd' @('-y','wrangler@4','d1','migrations','apply','artisys-mercadolivre','--remote','--config',$mlConfig)
  Invoke-Native 'npx.cmd' @('-y','wrangler@4','d1','migrations','list','artisys-mercadolivre','--remote','--config',$mlConfig)

  Write-Step 'Publicando Worker artisys-mercadolivre.'
  Invoke-Native 'npx.cmd' @('-y','wrangler@4','deploy','--config',$mlConfig)
  $mlDeployed = $true
  Pop-Location

  Write-Step '=== MERCADO LIVRE: SMOKE DE PRODUCAO ==='
  $health = Assert-HttpOk "$mlBase/api/health?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  $healthJson = $health.Content | ConvertFrom-Json
  $healthError = Get-OptionalProperty $healthJson 'error'
  if ($healthError) { throw "Mercado Livre /api/health retornou erro: $healthError" }

  $feed = Assert-HttpOk "$mlBase/api/site-catalog/feed?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  $feedJson = $feed.Content | ConvertFrom-Json
  if (-not (Test-PropertyExists $feedJson 'items')) { throw 'Feed Mercado Livre nao retornou a propriedade items.' }
  $feedItems = @($feedJson.PSObject.Properties['items'].Value)

  $admin = Assert-HttpOk "$mlBase/admin?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  if ($admin.Content -notmatch 'ArtiSys') { throw 'Admin Mercado Livre nao exibiu o acesso ao Catalogo ArtiSys.' }
  Write-Step "Mercado Livre OK; feed com $($feedItems.Count) item(ns) aprovado(s)."

  Write-Step '=== FASE 3: PUBLICAR SOMENTE O WEB/WORKER DO OBRA NA MAO COMERCIAL ==='
  Push-Location $obraDir
  Write-Step 'O backend operacional, bindings, D1, login e licenciamento nao foram alterados por esta entrega.'
  Invoke-Native 'npm.cmd' @('--prefix','apps/web','run','worker:deploy')
  $obraDeployed = $true

  Write-Step '=== OBRA NA MAO COMERCIAL: SMOKE OPERACIONAL ==='
  $env:PRODUCTION_URL = $obraBase
  $env:EXPECTED_SHA = $obraSha
  $env:DEPLOY_WAIT_MS = '180000'
  Invoke-Native 'npm.cmd' @('--prefix','apps/web','run','smoke:production')
  Remove-Item Env:EXPECTED_SHA -ErrorAction SilentlyContinue

  $catalog = Assert-HttpOk "$obraBase/sistemas/?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  if ($catalog.Content -notmatch 'Sistemas ArtiSys') { throw '/sistemas/ nao contem o catalogo ArtiSys esperado.' }
  $agro = Assert-HttpOk "$obraBase/sistemas/agro/?ts=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  if ($agro.Content -notmatch 'Agro') { throw '/sistemas/agro/ nao contem a colecao Agro esperada.' }
  Pop-Location

  Write-Step '=== DEPLOY CONCLUIDO COM SUCESSO ==='
  Write-Step "MercadoLivre: $mlSha"
  Write-Step "OBRANAMAOCOMERCIAL: $obraSha"
  Write-Step "Catalogo: $obraBase/sistemas/"
  Write-Step "Log: $logPath"
} catch {
  $message = $_.Exception.Message
  Write-Warning "Deploy interrompido: $message"

  if ($obraDeployed) {
    Rollback-Worker (Join-Path $obraDir 'apps\web') 'wrangler.jsonc' 'obra-na-mao-comercial'
  }
  if ($mlDeployed -and $mlConfig) {
    Rollback-Worker $mlDir $mlConfig 'artisys-mercadolivre'
  }

  if (-not $obraDeployed -and -not $mlDeployed) {
    Write-Step 'Falha ocorreu antes de qualquer deploy: producao permaneceu intocada.'
  } else {
    Write-Step 'Rollback automatico solicitado para todos os Workers que chegaram a ser publicados.'
  }
  Write-Step 'A migration 0006 do ML e aditiva (CREATE TABLE/INDEX IF NOT EXISTS) e pode permanecer sem afetar a automacao existente.'
  Write-Step "Log completo: $logPath"
  throw
}
