#ifndef AppVersion
  #define AppVersion "0.3.0"
#endif
#ifndef PackageDir
  #define PackageDir "..\..\dist\server-windows-x64"
#endif

[Setup]
AppId={{CB8C8B5A-1846-4BB1-BB17-F92B2BD52393}
AppName=Obra na Mão Server
AppVersion={#AppVersion}
AppPublisher=ArtiSys
DefaultDirName={autopf}\ArtiSys\Obra na Mão Server
DefaultGroupName=Obra na Mão Server
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
OutputBaseFilename=Obra-na-Mao-Server-Setup-{#AppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Obra na Mão Server
DisableProgramGroupPage=yes

[Tasks]
Name: "lanaccess"; Description: "Permitir acesso de outros computadores desta rede local"; Flags: unchecked

[Files]
Source: "{#PackageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PackageDir}\platform\preinstall-stop.ps1"; Flags: dontcopy

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File install-hooks.ps1 -Action Uninstall -InstallDir ""{app}"" -ProgramDataRoot ""{commonappdata}\ArtiSys\Obra na Mão Server"""; WorkingDir: "{app}\platform"; Flags: runhidden waituntilterminated; RunOnceId: "ObraNaMaoServerUninstall"

[Code]
var
  PostInstallExitCode: Integer;

function LanSwitch(Param: String): String;
begin
  if WizardIsTaskSelected('lanaccess') then
    Result := '-LanAccess'
  else
    Result := '';
end;

function GetCustomSetupExitCode: Integer;
begin
  Result := PostInstallExitCode;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  Params: String;
begin
  Result := '';
  ExtractTemporaryFile('preinstall-stop.ps1');
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\preinstall-stop.ps1') + '"';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := 'Não foi possível verificar/parar o serviço ObraNaMaoServer antes da atualização.'
  else if ResultCode <> 0 then
    Result := 'O serviço ObraNaMaoServer não pôde ser parado. A instalação foi cancelada para proteger os dados.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  PowerShellPath: String;
  PlatformDir: String;
  Params: String;
begin
  if CurStep = ssPostInstall then
  begin
    PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
    PlatformDir := ExpandConstant('{app}\platform');
    Params := '-NoProfile -ExecutionPolicy Bypass -File install-hooks.ps1 -Action Install -InstallDir "' +
      ExpandConstant('{app}') + '" -ProgramDataRoot "' +
      ExpandConstant('{commonappdata}\ArtiSys\Obra na Mão Server') + '" ' + LanSwitch('');
    Log('ObraNaMaoServer postinstall: launching Windows PowerShell hook.');
    if not Exec(PowerShellPath, Params, PlatformDir, SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      PostInstallExitCode := 1001;
      Log(Format('ObraNaMaoServer postinstall: Exec failed (%d: %s).', [ResultCode, SysErrorMessage(ResultCode)]));
      Exit;
    end;
    Log(Format('ObraNaMaoServer postinstall: hook exit code %d.', [ResultCode]));
    if ResultCode <> 0 then
      PostInstallExitCode := 1001;
  end;
end;
