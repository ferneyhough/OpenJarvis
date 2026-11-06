; Tauri NSIS installer hooks — grant microphone/webcam consent for the
; installed exe in the per-user Windows privacy store.

!include "StrFunc.nsh"

!macro NSIS_HOOK_POSTINSTALL
  StrCpy $R9 "$INSTDIR\openjarvis-desktop.exe"
  ${StrRep} $R9 "\" "#"
  StrCpy $R8 "SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore"
  WriteRegStr HKCU "$R8\microphone" "Value" "Allow"
  WriteRegStr HKCU "$R8\microphone\NonPackaged\$R9" "Value" "Allow"
  WriteRegStr HKCU "$R8\webcam" "Value" "Allow"
  WriteRegStr HKCU "$R8\webcam\NonPackaged\$R9" "Value" "Allow"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  StrCpy $R9 "$INSTDIR\openjarvis-desktop.exe"
  ${StrRep} $R9 "\" "#"
  StrCpy $R8 "SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore"
  DeleteRegKey HKCU "$R8\microphone\NonPackaged\$R9"
  DeleteRegKey HKCU "$R8\webcam\NonPackaged\$R9"
!macroend
