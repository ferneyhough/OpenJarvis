; Tauri NSIS installer hooks — grant microphone/webcam consent for the
; installed exe in the per-user Windows privacy store.
; NOTE: StrFunc calls are not allowed in the uninstall section, so the
; install hook stores the mangled consent key in the registry and the
; uninstall hook reads it back.

!include "StrFunc.nsh"

${Using:StrFunc} StrRep

!define CONSENT_STORE "SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore"
!define CONSENT_KEYVAL "Software\OpenJarvisDesktop"

!macro NSIS_HOOK_POSTINSTALL
  StrCpy $R9 "$INSTDIR\openjarvis-desktop.exe"
  ${StrRep} $R9 "$R9" "\" "#"
  StrCpy $R8 "${CONSENT_STORE}"
  WriteRegStr HKCU "$R8\microphone" "Value" "Allow"
  WriteRegStr HKCU "$R8\microphone\NonPackaged\$R9" "Value" "Allow"
  WriteRegStr HKCU "$R8\webcam" "Value" "Allow"
  WriteRegStr HKCU "$R8\webcam\NonPackaged\$R9" "Value" "Allow"
  WriteRegStr HKCU "${CONSENT_KEYVAL}" "ConsentKey" "$R9"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ReadRegStr $R9 HKCU "${CONSENT_KEYVAL}" "ConsentKey"
  ${If} $R9 != ""
    StrCpy $R8 "${CONSENT_STORE}"
    DeleteRegKey HKCU "$R8\microphone\NonPackaged\$R9"
    DeleteRegKey HKCU "$R8\webcam\NonPackaged\$R9"
    DeleteRegKey HKCU "${CONSENT_KEYVAL}"
  ${EndIf}
!macroend
