param([Parameter(Mandatory=$true)][string]$Scenario,[Parameter(Mandatory=$true)][string]$Release)
$ErrorActionPreference='Stop'
$base=Join-Path $env:RUNNER_TEMP 'obra-install-over'
$out=Join-Path $base 'evidence'
New-Item -ItemType Directory -Force -Path $base,$out | Out-Null
$install=Join-Path $env:ProgramFiles 'ObraUpdateCI\obra-na-mao-desktop-commercial'
$legacy=Join-Path $base 'legacy-1.0.18'
$data=Join-Path $env:APPDATA 'obra-na-mao-comercial'
$env:OBRA_NA_MAO_DATA_DIR=$data
$driver=Join-Path $PSScriptRoot 'windows-update-cdp.cjs'
$stdName='ObraCiStd'
$stdPassword='Ci!9'+[guid]::NewGuid().ToString('N')
Write-Output "::add-mask::$stdPassword"
$stdIdentity="$env:COMPUTERNAME\$stdName"
$credential=[pscredential]::new($stdIdentity,(ConvertTo-SecureString $stdPassword -AsPlainText -Force))

function Install-Official([string]$version) {
  $file=Join-Path $base "official-$version.exe"
  Invoke-WebRequest "https://github.com/$env:GITHUB_REPOSITORY/releases/download/desktop-commercial-v$version/Obra-na-Mao-Desktop-Setup-$version.exe" -OutFile $file
  $p=Start-Process $file -ArgumentList @('/S','/allusers',"/D=$install") -Wait -PassThru
  if($p.ExitCode -ne 0){throw "Official baseline $version failed: $($p.ExitCode)"}
}
function Stop-FixtureApp {
  Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Obra*Desktop.exe' -and ($_.ExecutablePath -like "$install\*" -or $_.ExecutablePath -like "$legacy\*")} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
}
function Start-StandardApp([string]$label) {
  $command=@"
@echo off
chcp 65001 >nul
set ELECTRON_RUN_AS_NODE=
set OBRA_NA_MAO_DATA_DIR=$data
set NODE_ENV=test
set ARTISYS_QA=1
"$exe" --remote-debugging-port=9224 --inspect=9232 --user-data-dir="$base/browser-$label"
"@
  $command | Set-Content "$base/app-$label.cmd" -Encoding utf8NoBOM
  Start-Process $env:ComSpec -ArgumentList @('/d','/c',"`"$base/app-$label.cmd`"") -Credential $credential -LoadUserProfile -WorkingDirectory $base -RedirectStandardOutput "$out/app-$label.log" -RedirectStandardError "$out/app-$label-error.log" | Out-Null
  node $driver snapshot $out 9224
  if($LASTEXITCODE -ne 0){throw "Full installed app could not be inspected: $label"}
  Copy-Item "$out/snapshot.json" "$out/snapshot-$label.json"
  Copy-Item "$out/screenshot.png" "$out/screenshot-$label.png" -ErrorAction SilentlyContinue
  return (Get-Content "$out/snapshot.json" -Raw | ConvertFrom-Json)
}
function Probe-Standard([string]$phase) {
  $command=@"
@echo off
chcp 65001 >nul
set ELECTRON_RUN_AS_NODE=1
"$exe" "$base/startup-permissions.cjs" "$install/resources/app.asar" "$data/fluxo-dre.sqlite" "$out/probe-$phase.json" $phase
"@
  $command | Set-Content "$base/probe-$phase.cmd" -Encoding utf8NoBOM
  $p=Start-Process $env:ComSpec -ArgumentList @('/d','/c',"`"$base/probe-$phase.cmd`"") -Credential $credential -LoadUserProfile -WorkingDirectory $base -PassThru -RedirectStandardOutput "$out/probe-$phase.log" -RedirectStandardError "$out/probe-$phase-error.log"
  if(-not $p.WaitForExit(60000)){throw "Startup probe timed out: $phase"}
  $result=Get-Content "$out/probe-$phase.json" -Raw | ConvertFrom-Json
  if($result.identity -ne $stdIdentity.ToLower()){throw 'Wrong Windows security identity'}
  return $result
}

try {
  if($Scenario -eq 'inside-stale') {Install-Official '1.0.18';Copy-Item -LiteralPath $install -Destination $legacy -Recurse}
  Install-Official '2.0.0'
  $exe=(Get-ChildItem $install -Filter 'Obra*Desktop.exe' -File | Select-Object -First 1).FullName
  $shareRoot=if($Scenario -eq 'external-canonical'){Join-Path $base 'outside-program'}else{$install}
  if($Scenario -in @('inside-nested','broken-share')){$shareRoot=Join-Path $install 'shared-data'}
  $documents=Join-Path $shareRoot 'DOCUMENTOS'
  New-Item -ItemType Directory -Force -Path $documents,$data | Out-Null
  $sentinel=Join-Path $documents 'preserve-me.txt'
  Set-Content $sentinel -Value 'CANONICAL-DOCUMENT-SENTINEL-20261016' -NoNewline
  $beforeHash=(Get-FileHash $sentinel -Algorithm SHA256).Hash
  New-LocalUser -Name $stdName -Password $credential.Password -AccountNeverExpires | Out-Null
  Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $stdName
  icacls $documents /grant "${stdIdentity}:(OI)(CI)M" /T | Out-Null
  New-SmbShare -Name 'obra-na-mao-desktop-commercial' -Path $shareRoot -FullAccess @([Security.Principal.WindowsIdentity]::GetCurrent().Name,$stdIdentity) | Out-Null
  $unc="\\$env:COMPUTERNAME\obra-na-mao-desktop-commercial\DOCUMENTOS"
  $env:FIXTURE_DATA=$data
  $env:FIXTURE_ROOT=$unc
  $env:FIXTURE_HASH=$beforeHash.ToLower()
  $env:FIXTURE_SIZE=(Get-Item $sentinel).Length
  @'
import sqlite3,subprocess,pathlib,os,ntpath
db=sqlite3.connect(pathlib.Path(os.environ['FIXTURE_DATA'])/'fluxo-dre.sqlite')
tag='desktop-commercial-v2.0.0'
files=subprocess.check_output(['git','ls-tree','-r','--name-only',tag,'apps/desktop/database/migrations'],text=True).splitlines()
for file in sorted(files):
    if not file.endswith('.sql'):continue
    version=int(pathlib.PurePosixPath(file).name.split('_')[0])
    db.executescript(subprocess.check_output(['git','show',tag+':'+file],text=True,encoding='utf-8'))
    db.execute('INSERT OR IGNORE INTO migrations(id,name) VALUES(?,?)',(version,pathlib.PurePosixPath(file).name))
    db.execute('PRAGMA user_version='+str(version))
db.execute("INSERT INTO empresas(razao_social,nome_fantasia) VALUES('CI PRESERVATION COMPANY','CI PRESERVATION COMPANY')")
db.execute("INSERT INTO configuracoes(chave,valor) VALUES('documentos_pasta_raiz',?)",(os.environ['FIXTURE_ROOT'],))
db.execute("INSERT INTO arquivos(nome_original,nome_armazenado,caminho,tamanho,extensao,mime_type,hash,origem) VALUES(?,?,?,?,?,?,?,?)",('Documento canônico.txt','preserve-me.txt',ntpath.join(os.environ['FIXTURE_ROOT'],'preserve-me.txt'),int(os.environ['FIXTURE_SIZE']),'.txt','text/plain',os.environ['FIXTURE_HASH'],'importado'))
db.execute("INSERT INTO documentos(arquivo_id,empresa_id,categoria,titulo) VALUES(1,1,'geral','Documento canônico')")
db.commit();db.close()
'@ | python -
  if($LASTEXITCODE -ne 0){throw 'SQLite fixture failed'}
  icacls $base /grant "${stdIdentity}:(OI)(CI)M" /T | Out-Null
  icacls $data /grant "${stdIdentity}:(OI)(CI)M" /T | Out-Null
  Copy-Item "$PSScriptRoot/windows-startup-permissions.cjs" "$base/startup-permissions.cjs"
  $before=Probe-Standard 'before'
  if($before.status -ne 'ready-and-writable'){throw 'Invalid fixture: existing folder must work before updating'}
  Get-Acl $documents | Format-List | Out-String | Set-Content "$out/acl-before.txt"

  $wsh=New-Object -ComObject WScript.Shell
  $menu=[Environment]::GetFolderPath('CommonPrograms')
  if($Scenario -eq 'inside-stale') {
    Get-ChildItem $menu -Recurse -Filter 'Obra*.lnk' | ForEach-Object {
      $s=$wsh.CreateShortcut($_.FullName)
      $s.TargetPath=(Get-ChildItem $legacy -Filter 'Obra*Desktop.exe' -File | Select-Object -First 1).FullName
      $s.Save()
    }
  }

  $fixed=Join-Path $Release 'Obra-na-Mao-Desktop-Setup-2.1.3.exe'
  if($Scenario -eq 'broken-share') {
    # A real old installer must cause the original UNKNOWN before testing repair.
    Install-Official '2.1.1'
    $broken=Start-StandardApp 'broken'
    if($broken.details -notmatch '(UNKNOWN: unknown error|EPERM: operation not permitted), mkdir' -or $broken.bootstrap){throw 'Original real document-root startup failure was not reproduced before repair'}
    $originalFailureCode=if($broken.details -match 'UNKNOWN:'){'UNKNOWN'}else{'EPERM'}
    Stop-FixtureApp
    $p=Start-Process $fixed -ArgumentList @('/S','/allusers',"/D=$install") -Wait -PassThru
    if($p.ExitCode -ne 0){throw "Install-over failed: $($p.ExitCode)"}
  } else {
    Start-Process node -ArgumentList @($driver,'serve',$Release) -RedirectStandardOutput "$out/server.log" -RedirectStandardError "$out/server-error.log" | Out-Null
    Start-Process $exe -ArgumentList @('--remote-debugging-port=9222','--inspect=9230') -RedirectStandardOutput "$out/baseline.log" -RedirectStandardError "$out/baseline-error.log" | Out-Null
    node $driver update $out
    if($LASTEXITCODE -ne 0){throw 'Original update button failed'}
    & "$PSScriptRoot/windows-installer-ui.ps1" -Evidence $out
    $reopened=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Obra*Desktop.exe'})
    $reopened | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json | Set-Content "$out/automatic-reopen.json"
    if(-not @($reopened | Where-Object {$_.ExecutablePath -eq $exe}).Count){throw 'Updater did not reopen the newly installed executable'}
    if(@($reopened | Where-Object {$_.ExecutablePath -like "$legacy\*"}).Count){throw 'Updater reopened stale executable'}
    Stop-FixtureApp
  }

  $version=(Get-Item $exe).VersionInfo.ProductVersion
  if($version -notlike '2.1.3*'){throw "Unexpected installed version: $version"}
  $snapshot=Start-StandardApp 'fixed'
  if($snapshot.bootstrap.version -ne '2.1.3' -or $snapshot.bootstrap.firstRun -ne $false -or $snapshot.details){throw 'Corrected installed app must boot with the original database'}
  if($snapshot.bootstrap.documentsPath -ne $unc){throw 'Canonical document root changed silently'}
  if(@($snapshot.companies | Where-Object {$_.razao_social -eq 'CI PRESERVATION COMPANY'}).Count -ne 1){throw 'Original company is not readable through the real app API'}
  if($Scenario -eq 'broken-share') {
    if($snapshot.documentRoot.ready -ne $false -or $snapshot.documentRoot.code -ne $originalFailureCode){throw 'Already-missing share must be reported without blocking startup or silently falling back'}
  } else {
    if((Get-FileHash $sentinel -Algorithm SHA256).Hash -ne $beforeHash){throw 'Canonical document changed or disappeared'}
    $after=Probe-Standard 'after'
    if($after.status -ne 'ready-and-writable'){throw 'Canonical document permissions were not preserved'}
    if($snapshot.documentRoot.ready -ne $true){throw 'Document root is no longer usable'}
  }
  Get-ChildItem $menu -Recurse -Filter 'Obra*.lnk' | ForEach-Object {
    $s=$wsh.CreateShortcut($_.FullName)
    if($s.TargetPath -ne $exe){throw "Stale Start Menu target: $($s.TargetPath)"}
  }
  Stop-FixtureApp
  # Repeat the same EXE over itself: repair must also be idempotent.
  $p=Start-Process $fixed -ArgumentList @('/S','/allusers',"/D=$install") -Wait -PassThru
  if($p.ExitCode -ne 0){throw 'Repeated install-over failed'}
  $repeat=Start-StandardApp 'repeat'
  if($repeat.bootstrap.version -ne '2.1.3' -or $repeat.bootstrap.firstRun -ne $false){throw 'Repeated install lost database or failed startup'}
  if($Scenario -ne 'broken-share' -and (Get-FileHash $sentinel -Algorithm SHA256).Hash -ne $beforeHash){throw 'Repeated install lost document'}
  @{scenario=$Scenario;version=$version;originalHash=$beforeHash;documentPreserved=($Scenario -ne 'broken-share');appBooted=$true;repeatBooted=$true;root=$unc} | ConvertTo-Json | Set-Content "$out/result.json"
  Get-Content "$out/result.json"
} finally {
  if(Test-Path $data) {
    @'
import sqlite3,os,pathlib,json
file=pathlib.Path(os.environ['FIXTURE_DATA'])/'fluxo-dre.sqlite'
if file.exists():
    db=sqlite3.connect(file.as_uri()+'?mode=ro',uri=True)
    result={'integrity':db.execute('PRAGMA integrity_check').fetchall(),'companies':db.execute('SELECT razao_social FROM empresas').fetchall(),'root':db.execute("SELECT valor FROM configuracoes WHERE chave='documentos_pasta_raiz'").fetchall(),'files':db.execute('SELECT caminho,hash FROM arquivos').fetchall(),'documents':db.execute('SELECT arquivo_id,empresa_id,titulo FROM documentos WHERE deleted_at IS NULL').fetchall()}
    print(json.dumps(result))
    assert result['integrity']==[('ok',)] and result['companies']==[('CI PRESERVATION COMPANY',)]
    import ntpath
    assert result['root']==[(os.environ['FIXTURE_ROOT'],)]
    assert result['files']==[(ntpath.join(os.environ['FIXTURE_ROOT'],'preserve-me.txt'),os.environ['FIXTURE_HASH'])]
    assert result['documents']==[(1,1,'Documento canônico')]
    db.close()
'@ | python - | Set-Content "$out/database-after.json"
    if($LASTEXITCODE -ne 0){throw 'SQLite integrity, canonical paths, hashes or document references changed'}
  }
  Get-SmbShare -Name 'obra-na-mao-desktop-commercial' -ErrorAction SilentlyContinue | Select-Object Name,Path | ConvertTo-Json | Set-Content "$out/share-after.json"
  Get-ChildItem $menu -Recurse -Filter 'Obra*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {$s=$wsh.CreateShortcut($_.FullName);@{link=$_.FullName;target=$s.TargetPath}} | ConvertTo-Json | Set-Content "$out/shortcuts-after.json"
}
