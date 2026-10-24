#ifndef AppVersion
  #error AppVersion is required
#endif
[Setup]
AppId={{497BD008-C5FA-4320-BB40-B0ECBB0383C6}
AppName=Udemy Study Tools
AppVersion={#AppVersion}
AppPublisher=HimanM
AppPublisherURL=https://github.com/HimanM/Udemy-Study-Tools
DefaultDirName={localappdata}\Programs\UdemyStudyTools
DefaultGroupName=Udemy Study Tools
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=Udemy-Study-Tools-{#AppVersion}-windows-x64-setup
SetupIconFile=..\extension\icons\study.ico
UninstallDisplayIcon={app}\UdemyStudyTools.exe
LicenseFile=..\LICENSE
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
[Files]
Source: "..\dist\UdemyStudyTools\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: checkedonce
[Icons]
Name: "{group}\Udemy Study Tools"; Filename: "{app}\UdemyStudyTools.exe"
Name: "{autodesktop}\Udemy Study Tools"; Filename: "{app}\UdemyStudyTools.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\UdemyStudyTools.exe"; Description: "Open Udemy Study Tools"; Flags: nowait postinstall skipifsilent
