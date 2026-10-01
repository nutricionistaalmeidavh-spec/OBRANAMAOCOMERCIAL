param(
  [string]$OutputDir,
  [string]$CacheDir = (Join-Path $env:TEMP 'obra-na-mao-server-build'),
  [string]$CommitSha = $(if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { 'local-build' }),
  [switch]$BuildInstaller
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$commonDir = (Resolve-Path (Join-Path $PSScriptRoot '../common')).Path
$lockPath = Join-Path $commonDir 'vendor-lock.json'
$lock = Get-Content $lockPath -Raw | ConvertFrom-Json
$nodeVersion = (Get-Content (Join-Path $repoRoot '.nvmrc') -Raw).Trim()
if ($nodeVersion -ne $lock.node.version) { throw "Node do vendor lock ($($lock.node.version)) diverge da .nvmrc ($nodeVersion)." }
if (-not $OutputDir) { $OutputDir = Join-Path $repoRoot 'apps/lan-server/dist/server-windows-x64' }
$serverVersion = (Get-Content (Join-Path $repoRoot 'apps/lan-server/package.json') -Raw | ConvertFrom-Json).version

function Get-VerifiedFile([string]$Url, [string]$Sha256, [string]$Destination) {
  New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) | Out-Null
  if (-not (Test-Path $Destination)) {
    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
  }
  $actual = (Get-FileHash -Path $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $Sha256.ToLowerInvariant()) {
    Remove-Item $Destination -Force -ErrorAction SilentlyContinue
    throw "Falha de checksum SHA256 em $Destination. Esperado $Sha256, recebido $actual."
  }
}

New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
$nodeArchive = Join-Path $CacheDir $lock.node.windowsX64.file
Get-VerifiedFile $lock.node.windowsX64.url $lock.node.windowsX64.sha256 $nodeArchive
$winswPath = Join-Path $CacheDir $lock.winsw.file
Get-VerifiedFile $lock.winsw.url $lock.winsw.sha256 $winswPath

$extractDir = Join-Path $CacheDir "node-$nodeVersion-win-x64"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
Expand-Archive -Path $nodeArchive -DestinationPath $extractDir -Force
$nodeExe = Join-Path $extractDir "node-v$nodeVersion-win-x64/node.exe"
if (-not (Test-Path $nodeExe)) { throw "node.exe não encontrado após extração: $nodeExe" }

$builderModule = Join-Path $commonDir 'build-package.mjs'
$platformFiles = @(
  @{ source = $winswPath; destination = 'ObraNaMaoServer.exe' },
  @{ source = (Join-Path $PSScriptRoot 'service.xml'); destination = 'ObraNaMaoServer.xml' },
  @{ source = (Join-Path $PSScriptRoot 'server.env.template'); destination = 'server.env.template' },
  @{ source = (Join-Path $PSScriptRoot 'service-control.ps1'); destination = 'service-control.ps1' },
  @{ source = (Join-Path $PSScriptRoot 'install-hooks.ps1'); destination = 'install-hooks.ps1' },
  @{ source = (Join-Path $PSScriptRoot 'preinstall-stop.ps1'); destination = 'preinstall-stop.ps1' }
) | ConvertTo-Json -Compress

$env:OBRA_PACKAGE_BUILDER = $builderModule
$env:OBRA_PACKAGE_REPO_ROOT = $repoRoot
$env:OBRA_PACKAGE_OUTPUT = $OutputDir
$env:OBRA_PACKAGE_NODE = $nodeExe
$env:OBRA_PACKAGE_COMMIT = $CommitSha
$env:OBRA_PACKAGE_PLATFORM_FILES = $platformFiles

$script = @'
import { pathToFileURL } from 'node:url';
const { buildServerPackage } = await import(pathToFileURL(process.env.OBRA_PACKAGE_BUILDER).href);
buildServerPackage({
  repoRoot: process.env.OBRA_PACKAGE_REPO_ROOT,
  outputDir: process.env.OBRA_PACKAGE_OUTPUT,
  platform: 'win32',
  arch: 'x64',
  commitSha: process.env.OBRA_PACKAGE_COMMIT,
  nodeBinaryPath: process.env.OBRA_PACKAGE_NODE,
  platformFiles: JSON.parse(process.env.OBRA_PACKAGE_PLATFORM_FILES)
});
'@
& node --input-type=module -e $script
if ($LASTEXITCODE -ne 0) { throw "build-package.mjs falhou com exit code $LASTEXITCODE" }
Write-Host "Windows Server package criado em $OutputDir"

if ($BuildInstaller) {
  if ([string]$lock.innoSetup.version -ne '7.1.0') { throw "Inno Setup deve permanecer pinado em 7.1.0." }
  $innoInstaller = Join-Path $CacheDir $lock.innoSetup.file
  Get-VerifiedFile $lock.innoSetup.url $lock.innoSetup.sha256 $innoInstaller
  $innoDir = Join-Path $CacheDir 'inno-7.1.0'
  $iscc = Join-Path $innoDir 'ISCC.exe'
  if (-not (Test-Path $iscc)) {
    New-Item -ItemType Directory -Force -Path $innoDir | Out-Null
    $process = Start-Process -FilePath $innoInstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER',"/DIR=$innoDir") -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Instalação de build do Inno Setup 7.1.0 falhou com exit code $($process.ExitCode)." }
  }
  if (-not (Test-Path $iscc)) { throw "ISCC.exe não encontrado após instalar Inno Setup 7.1.0 em $innoDir" }

  $installerOutput = Join-Path $repoRoot 'apps/lan-server/dist/installer'
  New-Item -ItemType Directory -Force -Path $installerOutput | Out-Null
  $issPath = Join-Path $PSScriptRoot 'installer.iss'
  & $iscc "/DAppVersion=$serverVersion" "/DPackageDir=$OutputDir" "/O$installerOutput" $issPath
  if ($LASTEXITCODE -ne 0) { throw "ISCC.exe falhou ao compilar installer.iss com exit code $LASTEXITCODE" }
  Write-Host "Instalador Windows criado em $installerOutput"
}
