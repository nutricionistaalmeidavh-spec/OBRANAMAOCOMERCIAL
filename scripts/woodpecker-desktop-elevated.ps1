param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$artifactsDir = Join-Path $repoRoot 'qa-artifacts\woodpecker'
$logPath = Join-Path $artifactsDir 'obra-comercial-desktop-elevated.log'
$reportPath = Join-Path $artifactsDir 'obra-comercial-desktop-elevated-report.json'
$failurePath = Join-Path $artifactsDir 'obra-comercial-desktop-elevated-failure.json'
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null
Remove-Item $failurePath -Force -ErrorAction SilentlyContinue
"=== Obra na Mao Comercial / Desktop Elevated QA ===" | Set-Content -Path $logPath -Encoding utf8

$script:results = @()

function Write-Log([string]$message) {
  Write-Host $message
  Add-Content -Path $logPath -Value $message -Encoding utf8
}

function Save-Report([string]$status) {
  [ordered]@{
    status = $status
    repository = if ($env:CI_REPO) { $env:CI_REPO } else { 'nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL' }
    branch = if ($env:CI_COMMIT_SOURCE_BRANCH) { $env:CI_COMMIT_SOURCE_BRANCH } elseif ($env:CI_COMMIT_BRANCH) { $env:CI_COMMIT_BRANCH } else { '' }
    commit = if ($env:CI_COMMIT_SHA) { $env:CI_COMMIT_SHA } else { '' }
    elevated = $true
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    gates = $script:results
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding utf8
}

function Fail-Gate([string]$name, [int]$exitCode, [string]$message) {
  $script:results += [ordered]@{ name = $name; status = 'fail'; exitCode = $exitCode }
  [ordered]@{ step = $name; exitCode = $exitCode; message = $message } | ConvertTo-Json -Depth 4 | Set-Content -Path $failurePath -Encoding utf8
  Save-Report 'fail'
  throw $message
}

function Pass-Gate([string]$name, [int]$durationMs) {
  $script:results += [ordered]@{ name = $name; status = 'pass'; exitCode = 0; durationMs = $durationMs }
  Write-Log "[PASS] $name (${durationMs}ms)"
}

function Invoke-Gate([string]$name, [scriptblock]$command) {
  Write-Log ""
  Write-Log "=== $name ==="
  $started = Get-Date
  $previousPreference = $ErrorActionPreference
  $exitCode = 0
  $message = ''
  try {
    $ErrorActionPreference = 'Continue'
    & $command 2>&1 | Tee-Object -FilePath $logPath -Append | ForEach-Object { Write-Host $_ }
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  } catch {
    $exitCode = 1
    $message = $_.Exception.Message
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  $durationMs = [int]((Get-Date) - $started).TotalMilliseconds
  if ($exitCode -ne 0) {
    if (-not $message) { $message = "$name falhou com codigo $exitCode." }
    Fail-Gate $name $exitCode $message
  }
  Pass-Gate $name $durationMs
}

try {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail-Gate 'windows-admin-token' 1 'Agent selecionado nao possui token administrativo real do Windows.'
  }
  Pass-Gate 'windows-admin-token' 0

  $policy = Join-Path $env:ARTISYS_UTILIDADES_PATH 'modules\artisys-windows-ci\bin\artisys-windows-ci.mjs'
  Invoke-Gate 'trusted-elevated-policy' { node $policy verify-elevated }
  Invoke-Gate 'node-version' { node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a!==22||b<12){console.error('Node 22.12+ e <23 obrigatorio; atual='+process.versions.node);process.exit(1)}console.log('Node '+process.versions.node)" }
  Invoke-Gate 'git-version' { git --version }
  Invoke-Gate 'npm-version' { npm --version }
  Invoke-Gate 'desktop-dependencies' { npm --prefix apps/desktop ci --no-audit --no-fund }

  Invoke-Gate 'electron-binary-prepare' {
    $electronRoot = Join-Path $repoRoot 'apps\desktop\node_modules\electron'
    $pathFile = Join-Path $electronRoot 'path.txt'
    $installScript = Join-Path $electronRoot 'install.js'
    if (-not (Test-Path $installScript)) { throw "Electron install.js ausente em $installScript" }
    if (-not (Test-Path $pathFile)) {
      Remove-Item (Join-Path $electronRoot 'dist') -Recurse -Force -ErrorAction SilentlyContinue
      & node $installScript
      if ($LASTEXITCODE -ne 0) { throw "Falha ao preparar Electron; codigo $LASTEXITCODE." }
    }
    & node -e "const fs=require('node:fs'),path=require('node:path');const root=path.resolve('apps/desktop/node_modules/electron'),pf=path.join(root,'path.txt');if(!fs.existsSync(pf)){console.error('Electron path.txt ausente');process.exit(1)}const rel=fs.readFileSync(pf,'utf8').trim(),bin=path.resolve(root,'dist',rel);if(!fs.existsSync(bin)){console.error('Electron binary ausente: '+bin);process.exit(1)}console.log('Electron preparado: '+bin)"
  }

  Invoke-Gate 'symlink-capability' {
    & node -e "const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'artisys-elevated-symlink-'));try{const target=path.join(dir,'target.txt'),link=path.join(dir,'link.txt');fs.writeFileSync(target,'ok');fs.symlinkSync(target,link);console.log('Symlink habilitado: '+link)}finally{fs.rmSync(dir,{recursive:true,force:true})}"
  }

  # Suite completa: nenhum --testNamePattern e nenhum skip especial para symlink.
  Invoke-Gate 'desktop-tests-full' { npm run test:desktop }
  Invoke-Gate 'desktop-build' { npm run build:desktop }

  Save-Report 'pass'
  Write-Log ""
  Write-Log 'DESKTOP ELEVATED QA: PASS'
  Write-Log "Relatorio: $reportPath"
  exit 0
} catch {
  if (-not (Test-Path $failurePath)) {
    [ordered]@{ step = 'workflow'; exitCode = 1; message = $_.Exception.Message } | ConvertTo-Json -Depth 4 | Set-Content -Path $failurePath -Encoding utf8
    Save-Report 'fail'
  }
  Write-Error $_.Exception.Message
  exit 1
}
