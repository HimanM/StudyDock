'use client';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
const Appearance = createContext(null);
export const useAppearance = () => useContext(Appearance);
export default function Theme({children}) {
  const [mode,setMode] = useState('dark');
  useEffect(() => {
    const media=matchMedia('(prefers-color-scheme: dark)');
    let saved;
    try { saved=localStorage.getItem('studydock-site-mode'); } catch {}
    setMode(saved==='light'||saved==='dark'?saved:media.matches?'dark':'light');
    const follow=()=>{try{if(localStorage.getItem('studydock-site-mode'))return;}catch{} setMode(media.matches?'dark':'light');};
    media.addEventListener('change',follow); return()=>media.removeEventListener('change',follow);
  },[]);
  useEffect(()=>{document.documentElement.dataset.theme=mode;},[mode]);
  const toggle=()=>setMode(previous=>{const next=previous==='dark'?'light':'dark';try{localStorage.setItem('studydock-site-mode',next);}catch{}return next;});
  const theme=useMemo(()=>createTheme({palette:{mode,primary:{main:mode==='dark'?'#adcaff':'#285ea8'},background:{default:mode==='dark'?'#14191f':'#f5f7fb',paper:mode==='dark'?'#20272f':'#ffffff'},text:{primary:mode==='dark'?'#e8edf4':'#202831',secondary:mode==='dark'?'#acb8c8':'#526173'}},typography:{fontFamily:'var(--font-roboto), Arial, sans-serif',button:{textTransform:'none',fontWeight:600}},shape:{borderRadius:14},components:{MuiButton:{defaultProps:{disableElevation:true},styleOverrides:{root:{borderRadius:28,padding:'11px 22px'}}},MuiIconButton:{styleOverrides:{root:{borderRadius:12}}}}}),[mode]);
  return <Appearance.Provider value={{mode,toggle}}><ThemeProvider theme={theme}><CssBaseline/>{children}</ThemeProvider></Appearance.Provider>;
}
