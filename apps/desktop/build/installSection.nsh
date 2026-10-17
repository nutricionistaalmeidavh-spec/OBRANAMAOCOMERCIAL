# Adapted from electron-builder 26.15.3 installSection.nsh (MIT).
# Deliberately overlay the application payload; never execute an older
# recursive uninstaller. Files outside the payload and their ACLs stay in place.
!include installer.nsh

InitPluginsDir

${IfNot} ${Silent}
  SetDetailsPrint none
${endif}

StrCpy $appExe "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!insertmacro setLinkVars

!ifdef ONE_CLICK
  !insertmacro CHECK_APP_RUNNING
!else
  ${ifNot} ${UAC_IsInnerInstance}
    !insertmacro CHECK_APP_RUNNING
  ${endif}
!endif

SetOutPath $INSTDIR
DetailPrint "Preservando pastas e documentos existentes durante a atualizacao."

!ifdef UNINSTALLER_ICON
  File /oname=uninstallerIcon.ico "${UNINSTALLER_ICON}"
!endif

!insertmacro installApplicationFiles
!insertmacro registryAddInstallInfo

# A preserved .lnk may target a different/older copy. Always repair the normal
# Start Menu/Desktop links and relaunch the executable just installed.
!insertmacro addStartMenuLink "false"
!insertmacro addDesktopLink "false"
StrCpy $launchLink "$appExe"

!ifmacrodef registerFileAssociations
  !insertmacro registerFileAssociations
!endif

!ifmacrodef customInstall
  !insertmacro customInstall
!endif

!macro doStartApp
  HideWindow
  !insertmacro StartApp
!macroend

!ifdef ONE_CLICK
  !ifdef RUN_AFTER_FINISH
    ${ifNot} ${Silent}
    ${orIf} ${isForceRun}
      !insertmacro doStartApp
    ${endIf}
  !else
    ${if} ${isForceRun}
      !insertmacro doStartApp
    ${endIf}
  !endif
  !insertmacro quitSuccess
!else
  ${if} ${isForceRun}
  ${andIf} ${Silent}
    !insertmacro doStartApp
  ${endIf}
!endif
