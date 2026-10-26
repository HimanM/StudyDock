(() => {
  const files = {CONTENT:'review-content.js',BOOT:'offline-review.js',REVIEW:'review.js'};
  const safeName = title => {
    const name = String(title || 'Practice exam').replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim().replace(/[. ]+$/g,'').slice(0,140) || 'Practice exam';
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' + name : name;
  };
  async function assets() {
    const entries = await Promise.all(Object.entries({...files,SHELL:'portable-shell.html'}).map(async ([key,path]) => {
      const response = await fetch(chrome.runtime.getURL(path)); if (!response.ok) throw Error('Missing offline viewer asset: '+path); return [key,await response.text()];
    })); return Object.fromEntries(entries);
  }
  function render(data, assets) {
    // Never let exam text close its inert JSON script element.
    const values = {...assets,DATA:JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')};
    return assets.SHELL.replace(/\{\{(DATA|CONTENT|BOOT|REVIEW)\}\}/g,(_,key) => key === 'DATA' ? values[key] : values[key].replace(/<\/script/gi,'<\\/script'));
  }
  async function chunks(data,value,full) {
    const size = /^all$/i.test(value.trim()) ? data.questions.length : Number(value);
    if (!Number.isSafeInteger(size) || size < 1 || (!/^all$/i.test(value.trim()) && (!/^\d+$/.test(value.trim()) || size < 5))) throw Error('Use a whole number of 5 or more, or All.');
    const result = StudyDockExport.prepare(data,full,true), resources = await assets();
    const parts = Math.ceil(result.questions.length / size), output = [];
    for (let start=0; start<result.questions.length; start+=size) {
      const part = {...result,part:output.length+1,parts,questions:result.questions.slice(start,start+size)};
      output.push({name:safeName(result.title)+(parts>1 ? ' - part '+part.part : '')+'.html',text:render(part,resources)});
    }
    return output;
  }
  globalThis.StudyDockPortable = {assets,render,chunks,safeName};
})();
