Unicode true
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\OpenJarvis"
InstallDirRegKey HKCU "Software\OpenJarvis" "InstallDir"
OutFile "Output\OpenJarvis-Setup-x64.exe"
SetCompressor /SOLID lzma

!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "x64.nsh"

!define APP_NAME "OpenJarvis"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenJarvisLegacy"

Name "${APP_NAME}"
Caption "${APP_NAME} Setup"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\OpenJarvis.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch OpenJarvis and complete setup"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This installer requires 64-bit Windows."
    Abort
  ${EndIf}
  SetShellVarContext current
  SetRegView 64
FunctionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
FunctionEnd

Section "OpenJarvis" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "dist\OpenJarvis\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\OpenJarvis" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "1.1.0"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "OpenJarvis"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Desktop shortcut" SEC_DESKTOP
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\OpenJarvis.exe"
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\OpenJarvis.exe"
SectionEnd

Section /o "Start OpenJarvis with Windows" SEC_STARTUP
  CreateDirectory "$SMSTARTUP"
  CreateShortCut "$SMSTARTUP\${APP_NAME}.lnk" "$INSTDIR\OpenJarvis.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  Delete "$SMSTARTUP\${APP_NAME}.lnk"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\OpenJarvis"
  RMDir /r "$INSTDIR"
SectionEnd
