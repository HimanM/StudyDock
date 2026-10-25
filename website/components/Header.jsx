'use client';
import {useState} from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import GitHub from '@mui/icons-material/GitHub';
import MenuRounded from '@mui/icons-material/MenuRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ExtensionRounded from '@mui/icons-material/ExtensionRounded';
import {useAppearance} from './Theme';
import {asset,REPOSITORY,STORE_URL,EXTENSION_ZIP} from '../lib/config';
export function InstallButton({small=false}) {
  return <Button variant="contained" size={small?'small':'large'} href={STORE_URL || EXTENSION_ZIP} startIcon={<ExtensionRounded/>}>{STORE_URL?'Add to Chrome':'Download extension'}</Button>;
}
export default function Header() {
  const {mode,toggle}=useAppearance(), [menu,setMenu]=useState(false);
  const links=[['The workspace','#workspace'],['Try it','#try-it'],['Downloads','#downloads']];
  return <header className="site-header"><a className="wordmark" href="#top" aria-label="StudyDock home"><img src={asset('images/studydock.png')} width="36" height="36" alt=""/>StudyDock</a>
    <nav aria-label="Main navigation" className="desktop-nav">{links.map(([label,href])=><a key={href} href={href}>{label}</a>)}</nav>
    <div className="header-actions"><IconButton aria-label={`Use ${mode==='dark'?'light':'dark'} theme`} onClick={toggle}>{mode==='dark'?<LightModeRounded/>:<DarkModeRounded/>}</IconButton><IconButton component="a" href={REPOSITORY} aria-label="StudyDock on GitHub"><GitHub/></IconButton><IconButton className="menu-button" aria-label="Open navigation" onClick={()=>setMenu(true)}><MenuRounded/></IconButton></div>
    <Drawer anchor="right" open={menu} onClose={()=>setMenu(false)}><nav className="mobile-nav" aria-label="Mobile navigation"><IconButton aria-label="Close navigation" onClick={()=>setMenu(false)}><CloseRounded/></IconButton>{links.map(([label,href])=><a key={href} href={href} onClick={()=>setMenu(false)}>{label}</a>)}</nav></Drawer>
  </header>;
}
