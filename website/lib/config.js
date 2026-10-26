export const REPOSITORY = 'https://github.com/HimanM/Udemy-Study-Tools';
export const VERSION = '1.5.0';
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const EXTENSION_ZIP = `${BASE_PATH}/downloads/StudyDock-extension.zip`;
export const PRIVATE_REPOSITORY = process.env.NEXT_PUBLIC_REPO_PRIVATE === 'true';
const store = process.env.NEXT_PUBLIC_CHROME_STORE_URL || '';
export const STORE_URL = /^https:\/\/chromewebstore\.google\.com\/detail\//.test(store) ? store : '';
export const asset = (path) => `${BASE_PATH}/${path}`;
export const packages = [
  {id:'windows', family:'windows', name:'Windows', detail:'Windows 10 / 11 · x64', file:'windows-x64-setup.exe', action:'Download for Windows', install:'Run the installer. StudyDock is added to your Start menu and desktop.'},
  {id:'mac-arm', family:'mac', name:'Mac · Apple Silicon', detail:'macOS 14+ · M-series chip', file:'macos-arm64.dmg', action:'Download for Apple Silicon', install:'Open the disk image and drag StudyDock into Applications.'},
  {id:'mac-intel', family:'mac', name:'Mac · Intel', detail:'macOS 15+ · Intel processor', file:'macos-x64.dmg', action:'Download for Intel Mac', install:'Open the disk image and drag StudyDock into Applications.'},
  {id:'linux', family:'linux', name:'Linux', detail:'x64 · glibc 2.35+ · X11 / XWayland', file:'linux-x64.bin', action:'Download for Linux', install:`chmod +x StudyDock-${VERSION}-linux-x64.bin\n./StudyDock-${VERSION}-linux-x64.bin --install`},
];
export const downloadURL = (file) => `${REPOSITORY}/releases/download/v${VERSION}/StudyDock-${VERSION}-${file}`;

export function detectOS(userAgent, platform = '', touchPoints = 0) {
  const value = `${platform} ${userAgent}`;
  if (/Android|iPhone|iPad|iPod/i.test(value) || (/Mac/i.test(platform) && touchPoints > 1)) return 'mobile';
  if (/Windows|Win32|Win64/i.test(value)) return 'windows';
  if (/Macintosh|MacIntel|macOS/i.test(value)) return 'mac';
  if (/CrOS/i.test(value)) return 'other';
  if (/Linux/i.test(value)) return 'linux';
  return 'other';
}
