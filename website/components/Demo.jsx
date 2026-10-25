'use client';
import {useState} from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import BookmarkRounded from '@mui/icons-material/BookmarkRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import {questions,exportExample} from '../lib/demo';
export default function Demo() {
  const [index,setIndex]=useState(0),[notes,setNotes]=useState({1:'Keep the reason, not just the answer letter.',2:''}),[tab,setTab]=useState('study'),[format,setFormat]=useState('md');
  const question=questions[index], output=exportExample(notes,format);
  function download() {
    const url=URL.createObjectURL(new Blob([output],{type:format==='json'?'application/json':'text/markdown;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`studydock-example.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="demo-shell"><div className="demo-top"><Tabs value={tab} onChange={(_,value)=>setTab(value)} aria-label="Interactive example"><Tab value="study" label="Study view" id="demo-study-tab" aria-controls="demo-study"/><Tab value="export" label="Export preview" id="demo-export-tab" aria-controls="demo-export"/></Tabs><span className="demo-caption">Illustrative questions</span></div>
    <div id="demo-study" role="tabpanel" aria-labelledby="demo-study-tab" hidden={tab!=='study'}><div className="demo-grid"><div className="demo-question"><div className="question-meta"><span>Question {question.number} / 2</span>{question.marked&&<span><BookmarkRounded fontSize="small"/>Marked for review</span>}</div><h3>{question.question}</h3>
      <div className="demo-choices">{question.options.map((option,i)=>{const letter=String.fromCharCode(65+i);return <div className={`demo-choice ${letter===question.correct?'correct':''}`} key={option}><span className="option-letter">{letter}</span><div>{option}{letter===question.selected&&<small>Your answer</small>}</div>{letter===question.correct&&<CheckRounded aria-label="Correct answer"/>}</div>;})}</div><p className="demo-explanation"><strong>Why this works</strong>{question.explanation}</p>
      <div className="question-navigation"><IconButton aria-label="Previous example question" onClick={()=>setIndex(i=>i-1)} disabled={index===0}><ArrowBackRounded/></IconButton><span>Try the next question. Your note stays with this one.</span><IconButton aria-label="Next example question" onClick={()=>setIndex(i=>i+1)} disabled={index===questions.length-1}><ArrowForwardRounded/></IconButton></div>
    </div><aside className="demo-notes"><div><span className="eyebrow">Your own thinking</span><h3>Question {question.number} notes</h3><p>Write a reminder you would want to read next time.</p></div><TextField fullWidth multiline minRows={5} maxRows={9} label={`Your note for question ${question.number}`} value={notes[question.number]||''} onChange={event=>setNotes({...notes,[question.number]:event.target.value})} slotProps={{htmlInput:{maxLength:4000}}}/><small>Try editing this. Demo notes stay in this page until you reload.</small></aside></div></div>
    <div id="demo-export" role="tabpanel" aria-labelledby="demo-export-tab" hidden={tab!=='export'}><div className="export-toolbar"><ToggleButtonGroup exclusive value={format} onChange={(_,value)=>value&&setFormat(value)} aria-label="Example export format" size="small"><ToggleButton value="md">Markdown</ToggleButton><ToggleButton value="json">JSON</ToggleButton></ToggleButtonGroup><Button startIcon={<DownloadRounded/>} onClick={download}>Download this example</Button></div><pre className="export-code" tabIndex="0" aria-label="Generated export preview">{output}</pre></div>
  </div>;
}
