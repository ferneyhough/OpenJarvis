Unicode true
RequestExecutionLevel admin
InstallDir "$PROGRAMFILES64\OpenJarvis"
OutFile "Output\OpenJarvis-Setup-x64.exe"
SetCompressor /SOLID lzma

!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "StrFunc.nsh"
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
  SetShellVarContext all
  SetRegView 64
FunctionEnd

Function un.onInit
  SetShellVarContext all
  SetRegView 64
FunctionEnd

Section "OpenJarvis" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "dist\OpenJarvis\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\OpenJarvis" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "1.1.0"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "OpenJarvis"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1

  # Grant this install microphone + webcam consent (Windows per-app privacy
  # store). The NonPackaged subkey name encodes the exe path with '#' for '\'.
  StrCpy $R9 "$INSTDIR\OpenJarvis.exe"
  ${StrRep} $R9 "\" "#"
  StrCpy $R8 "SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore"
  WriteRegStr HKCU "$R8\microphone" "Value" "Allow"
  WriteRegStr HKCU "$R8\microphone\NonPackaged\$R9" "Value" "Allow"
  WriteRegStr HKCU "$R8\webcam" "Value" "Allow"
  WriteRegStr HKCU "$R8\webcam\NonPackaged\$R9" "Value" "Allow"
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
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  DeleteRegKey HKLM "Software\OpenJarvis"
  StrCpy $R9 "$INSTDIR\OpenJarvis.exe"
  ${StrRep} $R9 "\" "#"
  StrCpy $R8 "SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore"
  DeleteRegKey HKCU "$R8\microphone\NonPackaged\$R9"
  DeleteRegKey HKCU "$R8\webcam\NonPackaged\$R9"
  RMDir /r "$INSTDIR"
SectionEnd
