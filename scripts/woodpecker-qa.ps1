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
"=== Obra na Mao Comercial / Woodpecker Web QA ===" | Set-Content -Path $logPath -Encoding utf8
$script:results = @()
function Write-Log([string]$message){Write-Host $message;Add-Content -Path $logPath -Value $message -Encoding utf8}
function Save-Report([string]$status){$payload=[ordered]@{status=$status;repository=if($env:CI_REPO){$env:CI_REPO}else{'nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL'};branch=if($env:CI_COMMIT_SOURCE_BRANCH){$env:CI_COMMIT_SOURCE_BRANCH}elseif($env:CI_COMMIT_BRANCH){$env:CI_COMMIT_BRANCH}else{''};commit=if($env:CI_COMMIT_SHA){$env:CI_COMMIT_SHA}else{''};generatedAt=(Get-Date).ToUniversalTime().ToString('o');gates=$script:results};$payload|ConvertTo-Json -Depth 6|Set-Content -Path $reportPath -Encoding utf8}
function Fail-Gate([string]$name,[int]$exitCode,[string]$message){$script:results += [ordered]@{name=$name;status='fail';exitCode=$exitCode};[ordered]@{step=$name;exitCode=$exitCode;message=$message}|ConvertTo-Json -Depth 4|Set-Content -Path $failurePath -Encoding utf8;Save-Report 'fail';throw $message}
function Invoke-Gate([string]$name,[scriptblock]$command){Write-Log "";Write-Log "=== $name ===";$started=Get-Date;$previousPreference=$ErrorActionPreference;$exitCode=0;try{$ErrorActionPreference='Continue';& $command 2>&1|Tee-Object -FilePath $logPath -Append|ForEach-Object{Write-Host $_};$exitCode=if($null -eq $LASTEXITCODE){0}else{[int]$LASTEXITCODE}}finally{$ErrorActionPreference=$previousPreference};$durationMs=[int]((Get-Date)-$started).TotalMilliseconds;if($exitCode -ne 0){Fail-Gate $name $exitCode "$name falhou com codigo $exitCode."};$script:results += [ordered]@{name=$name;status='pass';exitCode=0;durationMs=$durationMs};Write-Log "[PASS] $name (${durationMs}ms)"}
try{
  Invoke-Gate 'node-version' { node -e "const [a,b]=process.versions.node.split('.').map(Number); if(a!==22 || b<12){console.error('Node 22.12+ e <23 obrigatorio; atual='+process.versions.node); process.exit(1)} console.log('Node '+process.versions.node)" }
  Invoke-Gate 'git-version' { git --version }
  Invoke-Gate 'npm-version' { npm --version }
  Invoke-Gate 'woodpecker-split-contract' { node scripts/verify-woodpecker-split.mjs }
  Invoke-Gate 'catalog-contract' { npm --prefix apps/web run catalog:verify }
  Invoke-Gate 'web-dependencies' { npm --prefix apps/web ci --no-audit --no-fund }
  Invoke-Gate 'contracts-typecheck' { npm run typecheck:contracts }
  Invoke-Gate 'web-tests' { npm run test:web }
  Invoke-Gate 'web-ux-contract' { npm --prefix apps/web run ux:verify }
  Invoke-Gate 'web-seo-contract' { npm --prefix apps/web run seo:generate; if($LASTEXITCODE -eq 0){npm --prefix apps/web run seo:verify} }
  Invoke-Gate 'web-assets-contract' { npm --prefix apps/web run assets:verify }
  Invoke-Gate 'web-build' { npm run build:web }
  Save-Report 'pass';Write-Log "";Write-Log "WEB QA COMPLETO: PASS";Write-Log "Relatorio: $reportPath";exit 0
}catch{if(-not(Test-Path $failurePath)){[ordered]@{step='workflow';exitCode=1;message=$_.Exception.Message}|ConvertTo-Json -Depth 4|Set-Content -Path $failurePath -Encoding utf8;Save-Report 'fail'};Write-Error $_.Exception.Message;exit 1}
