import fs from 'node:fs';
import path from 'node:path';
function inline(text) {
  return text.split(/(\[[^\]]+\]\(https:\/\/[^)]+\)|`[^`]+`)/g).map((part,index)=>{
    const link=part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    if(link)return <a key={index} href={link[2]}>{link[1]}</a>;
    if(part.startsWith('`')&&part.endsWith('`'))return <code key={index}>{part.slice(1,-1)}</code>;
    return part;
  });
}
export default function Privacy() {
  const policy=fs.readFileSync(path.join(process.cwd(),'../docs/PRIVACY.md'),'utf8');
  return <section id="privacy" className="privacy-section"><div><span className="eyebrow">Your study material</span><h2>Kept on your side.</h2><p>Notes live in your Chrome profile. Exports are files on your computer. StudyDock has no analytics or cloud AI service.</p></div><details className="privacy-policy"><summary>Read the privacy policy</summary><div>{policy.split(/\r?\n\r?\n/).filter(block=>!block.startsWith('# ')).map((block,index)=>block.startsWith('## ')?<h3 key={index}>{block.slice(3)}</h3>:<p key={index}>{inline(block)}</p>)}</div></details></section>;
}
