'use client';
import {useEffect,useState} from 'react';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import DesktopWindowsRounded from '@mui/icons-material/DesktopWindowsRounded';
import LaptopMacRounded from '@mui/icons-material/LaptopMacRounded';
import ComputerRounded from '@mui/icons-material/ComputerRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import {detectOS,downloadURL,packages,PRIVATE_REPOSITORY,REPOSITORY,VERSION} from '../lib/config';
export default function Downloads() {
  const [detected,setDetected]=useState('other'),[selected,setSelected]=useState('');
  useEffect(()=>{const os=detectOS(navigator.userAgent,navigator.userAgentData?.platform||navigator.platform,navigator.maxTouchPoints);setDetected(os);if(os==='windows'||os==='linux')setSelected(os);},[]);
  const choice=packages.find(item=>item.id===selected);
  const icons={windows:<DesktopWindowsRounded/>,mac:<LaptopMacRounded/>,linux:<ComputerRounded/>};
  return <div className="download-layout"><div className="download-list" aria-label="Desktop packages">{packages.map(item=><button key={item.id} className={`platform-row ${selected===item.id?'selected':''}`} onClick={()=>setSelected(item.id)} aria-pressed={selected===item.id}>
    <span className="platform-icon">{icons[item.family]}</span><span><strong>{item.name}</strong><small>{item.detail}</small></span><span className="platform-status">{selected===item.id?<CheckCircleRounded/>:detected===item.family?<span>For your OS</span>:null}</span></button>)}</div>
    <div className="download-detail"><span className="eyebrow">Optional desktop exporter · v{VERSION}</span><h3>{choice?choice.name:detected==='mac'?'Choose your Mac chip':'Choose your desktop'}</h3><p>{detected==='mac'?'Check Apple menu → About This Mac for Apple Silicon or Intel. Browser detection cannot reliably identify the chip.':detected==='mobile'?'You’re browsing on a mobile device. The desktop exporter runs on a supported Windows, Mac or Linux computer.':detected==='other'?'Choose the platform you will install on. The browser extension works independently of the desktop exporter.':'We’ve highlighted your operating system. Check the requirements before downloading.'}</p>
    <FormControl fullWidth size="small"><InputLabel id="platform-label">Desktop package</InputLabel><Select labelId="platform-label" label="Desktop package" value={selected} onChange={event=>setSelected(event.target.value)}>{packages.map(item=><MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>
    {choice?<><Button variant="contained" size="large" href={downloadURL(choice.file)} startIcon={<DownloadRounded/>} fullWidth>{choice.action}</Button><p className="requirements">{choice.detail}. {choice.family==='linux'?'No Python, pip or FUSE needed. Alpine/musl, Linux ARM and older glibc are not supported.':'Python is bundled. These packages are unsigned.'}</p>{choice.family==='linux'?<pre className="install-command">{choice.install}</pre>:<p className="install-help">{choice.install}</p>}{choice.family==='windows'&&<a className="text-link" href={downloadURL('windows-x64-portable.zip')}>Prefer the portable ZIP?</a>}</>:<p className="selection-hint">Select a package to see its download and installation steps.</p>}
    <div className="download-footnote">{PRIVATE_REPOSITORY&&<p>Downloads currently require a GitHub account with access to the private repository.</p>}<a href={`${REPOSITORY}/blob/v${VERSION}/install.py`}>Optional Python installer</a><span> · </span><a href={`${REPOSITORY}/releases`}>All releases</a></div></div>
  </div>;
}
