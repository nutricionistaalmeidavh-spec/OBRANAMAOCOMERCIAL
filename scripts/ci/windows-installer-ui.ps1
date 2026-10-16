param([Parameter(Mandatory=$true)][string]$Evidence,[switch]$HoldBeforeRun)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class InstallerUi {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, Callback callback, IntPtr param);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder text,int size);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h,int id);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,uint message,IntPtr w,IntPtr l);
  public static string Text(IntPtr h){var s=new StringBuilder(2048);GetWindowText(h,s,s.Capacity);return s.ToString();}
  public static string[] Children(IntPtr h){var rows=new List<string>();EnumChildWindows(h,(c,p)=>{var text=Text(c);if(text.Length>0)rows.Add(text);return true;},IntPtr.Zero);return rows.ToArray();}
}
'@
$observations=@()
for($i=0;$i -lt 90;$i++) {
  $windows=@(Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*Obra*' -and $_.ProcessName -notlike '*Desktop'})
  foreach($p in $windows) {
    $h=$p.MainWindowHandle
    $next=[InstallerUi]::GetDlgItem($h,1)
    $record=[ordered]@{elapsedSeconds=($i*2);pid=$p.Id;process=$p.ProcessName;title=$p.MainWindowTitle;controls=[InstallerUi]::Children($h);nextText=[InstallerUi]::Text($next);clicked=$false}
    if($HoldBeforeRun -and $record.nextText -match 'Finish') {
      $record.heldForStandardUserReopen=$true
      $observations+=$record
      $observations | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Evidence 'native-installer-ui.json')
      Write-Host 'Installer completed. Holding Finish so an elevated runner does not recreate the deleted document directory before the limited-user startup probe.'
      return
    }
    # First ten seconds are observation only: record whether a supposedly
    # automatic update requires another interaction before driving the wizard.
    if($i -ge 5 -and $next -ne [IntPtr]::Zero -and [InstallerUi]::IsWindowEnabled($next) -and [InstallerUi]::IsWindowVisible($next)) {
      [void][InstallerUi]::SendMessage($next,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)
      $record.clicked=$true
    }
    $observations+=$record
    Write-Host ($record | ConvertTo-Json -Compress)
  }
  if($i -ge 8 -and $windows.Count -eq 0 -and @(Get-Process | Where-Object {$_.ProcessName -like 'Obra*Desktop'}).Count -gt 0){break}
  Start-Sleep -Seconds 2
}
$observations | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Evidence 'native-installer-ui.json')
