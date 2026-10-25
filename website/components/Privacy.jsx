import fs from 'node:fs';
import path from 'node:path';
import {asset} from '../lib/config';
function inline(text) {
  return text.split(/(\[[^\]]+\]\(https:\/\/[^)]+\)|`[^`]+`)/g).map((part,index)=>{
    const link=part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    if(link)return <a key={index} href={link[2]}>{link[1]}</a>;
    if(part.startsWith('`')&&part.endsWith('`'))return <code key={index}>{part.slice(1,-1)}</code>;
    return part;
  });
}
export function PrivacyPolicy() {
  const policy=fs.readFileSync(path.join(process.cwd(),'../docs/PRIVACY.md'),'utf8');
  return policy.split(/\r?\n\r?\n/).filter(block=>!block.startsWith('# ')).map((block,index)=>block.startsWith('## ')?<h2 key={index}>{block.slice(3)}</h2>:<p key={index}>{inline(block)}</p>);
}
export default function Privacy() {
  return <section id="privacy" className="privacy-section"><div><span className="eyebrow">Your study material</span><h2>Kept on your side.</h2><p>Notes live in your Chrome profile. Exports are files on your computer. StudyDock has no analytics or cloud AI service.</p></div><div className="privacy-intro"><p>Read how StudyDock uses question content, stores notes and handles browser and desktop exports.</p><a className="text-link" href={asset('privacy/')}>Read the privacy policy</a></div></section>;
}
