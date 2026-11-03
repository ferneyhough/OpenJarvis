#define MyAppName "Open Jarvis"
#define MyAppVersion "1.1.0"
#define MyAppExe "OpenJarvis.exe"

[Setup]
AppId={{8F3C2A51-6B7E-4E2B-9C1D-0A7B3E5F9D21}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Open Jarvis
DefaultDirName={localappdata}\Programs\OpenJarvis
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=OpenJarvis-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExe}

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"
Name: "startup"; Description: "Start Open Jarvis with Windows (so ""Hey Jarvis"" always works)"; Flags: unchecked

[Files]
Source: "dist\OpenJarvis\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
