#ifndef AppVersion
  #error AppVersion is required
#endif
[Setup]
AppId={{497BD008-C5FA-4320-BB40-B0ECBB0383C6}
AppName=StudyDock
AppVersion={#AppVersion}
VersionInfoVersion={#AppNumericVersion}
VersionInfoProductTextVersion={#AppVersion}
AppPublisher=HimanM
AppPublisherURL=https://github.com/HimanM/StudyDock
DefaultDirName={localappdata}\Programs\UdemyStudyTools
DefaultGroupName=StudyDock
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=StudyDock-{#AppVersion}-windows-x64-setup
SetupIconFile=..\extension\icons\study.ico
UninstallDisplayIcon={app}\StudyDock.exe
LicenseFile=..\LICENSE
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
[Files]
Source: "..\dist\StudyDock\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: checkedonce
[Icons]
Name: "{group}\StudyDock"; Filename: "{app}\StudyDock.exe"
Name: "{autodesktop}\StudyDock"; Filename: "{app}\StudyDock.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\StudyDock.exe"; Description: "Open StudyDock"; Flags: nowait postinstall skipifsilent
