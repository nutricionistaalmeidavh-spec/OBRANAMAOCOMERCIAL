param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$artifactsDir = Join-Path $repoRoot 'qa-artifacts\woodpecker'
$logPath = Join-Path $artifactsDir 'obra-comercial-qa.log'
$reportPath = Join-Path $artifactsDir 'obra-comercial-qa-report.json'
$failurePath = Join-Path $artifactsDir 'obra-comercial-failure.json'

New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null
Remove-Item $failurePath -Force -ErrorAction SilentlyContinue
"=== Obra na Mao Comercial / Woodpecker QA ===" | Set-Content -Path $logPath -Encoding utf8

$script:results = @()

function Write-Log([string]$message) {
  Write-Host $message
  Add-Content -Path $logPath -Value $message -Encoding utf8
}

function Save-Report([string]$status) {
  $payload = [ordered]@{
    status = $status
    repository = if ($env:CI_REPO) { $env:CI_REPO } else { 'nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL' }
    branch = if ($env:CI_COMMIT_SOURCE_BRANCH) { $env:CI_COMMIT_SOURCE_BRANCH } elseif ($env:CI_COMMIT_BRANCH) { $env:CI_COMMIT_BRANCH } else { '' }
    commit = if ($env:CI_COMMIT_SHA) { $env:CI_COMMIT_SHA } else { '' }
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    gates = $script:results
  }
  $payload | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding utf8
}

function Fail-Gate([string]$name, [int]$exitCode, [string]$message) {
  $script:results += [ordered]@{ name = $name; status = 'fail'; exitCode = $exitCode }
  [ordered]@{ step = $name; exitCode = $exitCode; message = $message } |
    ConvertTo-Json -Depth 4 | Set-Content -Path $failurePath -Encoding utf8
  Save-Report 'fail'
  throw $message
}

function Invoke-Gate([string]$name, [scriptblock]$command) {
  Write-Log ""
  Write-Log "=== $name ==="
  $started = Get-Date
  $previousPreference = $ErrorActionPreference
  $exitCode = 0
  try {
    # Windows PowerShell 5 pode transformar stderr de executaveis nativos em
    # NativeCommandError. O codigo de saida do processo continua sendo a fonte
    # de verdade para npm/node/git.
    $ErrorActionPreference = 'Continue'
    & $command 2>&1 | Tee-Object -FilePath $logPath -Append | ForEach-Object { Write-Host $_ }
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  $durationMs = [int]((Get-Date) - $started).TotalMilliseconds
  if ($exitCode -ne 0) {
    Fail-Gate $name $exitCode "$name falhou com codigo $exitCode."
  }

  $script:results += [ordered]@{ name = $name; status = 'pass'; exitCode = 0; durationMs = $durationMs }
  Write-Log "[PASS] $name (${durationMs}ms)"
}

function Test-SymlinkCapability {
  $probe = Join-Path ([IO.Path]::GetTempPath()) ('artisys-symlink-probe-' + [guid]::NewGuid().ToString('N'))
  $target = Join-Path $probe 'target.txt'
  $link = Join-Path $probe 'link.txt'
  New-Item -ItemType Directory -Force -Path $probe | Out-Null
  Set-Content -Path $target -Value 'probe' -Encoding ascii
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    node -e "const fs=require('node:fs');try{fs.symlinkSync(process.argv[1],process.argv[2]);process.exit(0)}catch(e){process.exit((e&&['EPERM','EACCES'].includes(e.code))?2:3)}" $target $link *> $null
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $previousPreference
    Remove-Item $probe -Recurse -Force -ErrorAction SilentlyContinue
  }
}

try {
  Invoke-Gate 'node-version' { node -e "const [a,b]=process.versions.node.split('.').map(Number); if(a!==22 || b<12){console.error('Node 22.12+ e <23 obrigatorio; atual='+process.versions.node); process.exit(1)} console.log('Node '+process.versions.node)" }
  Invoke-Gate 'git-version' { git --version }
  Invoke-Gate 'npm-version' { npm --version }

  # Fase 0-3 do catalogo: falha rapido antes de baixar dependencias pesadas.
  Invoke-Gate 'catalog-contract' { node apps/web/scripts/verify-public-catalog.mjs }

  Invoke-Gate 'web-dependencies' { npm --prefix apps/web ci --no-audit --no-fund }
  Invoke-Gate 'desktop-dependencies' { npm --prefix apps/desktop ci --no-audit --no-fund }

  Invoke-Gate 'contracts-typecheck' { npm run typecheck:contracts }
  Invoke-Gate 'web-tests' { npm run test:web }
  Invoke-Gate 'web-ux-contract' { npm --prefix apps/web run ux:verify }
  Invoke-Gate 'web-seo-contract' { npm --prefix apps/web run seo:verify }
  Invoke-Gate 'web-assets-contract' { npm --prefix apps/web run assets:verify }
  Invoke-Gate 'web-build' { npm run build:web }

  if (Test-SymlinkCapability) {
    Write-Log '[Desktop] Ambiente permite symlink: suite completa habilitada.'
    Invoke-Gate 'desktop-tests' { npm run test:desktop }
  } else {
    Write-Log '[Desktop] Agent Windows limitado nao possui privilegio para criar symlink. Os 2 casos cujo setup exige symlink serao omitidos; os demais testes continuam obrigatorios.'
    Invoke-Gate 'desktop-tests-limited-windows' { npm --prefix apps/desktop test -- --testNamePattern '^(?!.*symlink).*$' }
  }

  Invoke-Gate 'desktop-build' { npm run build:desktop }

  Save-Report 'pass'
  Write-Log ""
  Write-Log "QA COMPLETO: PASS"
  Write-Log "Relatorio: $reportPath"
  exit 0
} catch {
  if (-not (Test-Path $failurePath)) {
    [ordered]@{ step = 'workflow'; exitCode = 1; message = $_.Exception.Message } |
      ConvertTo-Json -Depth 4 | Set-Content -Path $failurePath -Encoding utf8
    Save-Report 'fail'
  }
  Write-Error $_.Exception.Message
  exit 1
}
