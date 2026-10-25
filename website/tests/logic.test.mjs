import test from 'node:test';
import assert from 'node:assert/strict';
import {detectOS,packages,downloadURL} from '../lib/config.js';
import {exportExample} from '../lib/demo.js';
test('platform suggestions do not guess Mac chips or offer desktop builds to mobile',()=>{
  assert.equal(detectOS('Windows NT 10.0; Win64; x64','Win32'),'windows');
  assert.equal(detectOS('Macintosh; Intel Mac OS X','MacIntel'),'mac');
  assert.equal(detectOS('Macintosh; Intel Mac OS X','MacIntel',5),'mobile');
  assert.equal(detectOS('Linux; Android 15','Linux'),'mobile');
  assert.equal(detectOS('X11; Linux x86_64','Linux x86_64'),'linux');
  assert.equal(detectOS('X11; CrOS x86_64','Linux x86_64'),'other');
  assert.equal(detectOS('unknown','unknown'),'other');
  assert.equal(packages.filter(item=>item.family==='mac').length,2);
  assert.ok(downloadURL(packages[0].file).endsWith('-windows-x64-setup.exe'));
});
test('example exports keep notes attached to their own question',()=>{
  const notes={1:'My first reminder',2:'A different reminder'};
  const json=JSON.parse(exportExample(notes,'json'));
  assert.equal(json.questions[0].notes.text,notes[1]);
  assert.equal(json.questions[1].notes.text,notes[2]);
  assert.equal(json.questions[0].marked_for_review,true);
  const markdown=exportExample(notes,'md');
  assert.ok(markdown.indexOf(notes[1])<markdown.indexOf('## Question 2'));
  assert.ok(markdown.indexOf(notes[2])>markdown.indexOf('## Question 2'));
});
