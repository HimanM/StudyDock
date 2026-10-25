'use client';
import {useState} from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseRounded from '@mui/icons-material/CloseRounded';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import {asset} from '../lib/config';
export default function ProductShot({src,alt,caption,priority=false}) {
  const [open,setOpen]=useState(false);
  return <><figure className="product-shot"><button className="shot-button" onClick={()=>setOpen(true)} aria-label={`Enlarge screenshot: ${caption}`}><img src={asset(src)} width="1280" height="800" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} alt={alt}/><span className="enlarge"><OpenInFullRounded fontSize="small"/></span></button><figcaption>{caption}</figcaption></figure>
    <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="xl" fullWidth aria-label={caption}><div className="image-dialog"><IconButton aria-label="Close screenshot" onClick={()=>setOpen(false)}><CloseRounded/></IconButton><img src={asset(src)} alt={alt}/></div></Dialog></>;
}
