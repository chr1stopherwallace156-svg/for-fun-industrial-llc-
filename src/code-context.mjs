// Offline, read-only source retrieval for small-context local coding assistants.
// Does not execute code, modify files, run shell, Git, or network requests.
import fs from 'node:fs/promises';
import path from 'node:path';

const SKIP_DIRS=new Set(['.git','.runtime','.venv','venv','node_modules','__pycache__','dist','build','coverage','.next','.tox','.cache','private','secrets']);
const SKIP_NAMES=new Set(['.env','.env.local','.env.production','credentials.json','secrets.json','package-lock.json','pnpm-lock.yaml','yarn.lock']);
const EXT=new Set(['.mjs','.cjs','.js','.jsx','.ts','.tsx','.py','.rs','.go','.java','.cpp','.c','.h','.hpp','.md']);
const STOP=new Set('the and for with from that this into when where what your about code file please find fix make show use using can are all you need want build error inspect check give will have like repo repository source function software'.split(' '));
const INTENT=/\b(codebase|source code|coding|programming|software development|repository|repo|function|refactor|debug|bug|implement|patch|compile|stack trace|unit test|failing test|review (?:the )?code|edit (?:the )?file|\.mjs|\.py|\.ts|\.js|\.rs)\b/i;
export function isCodingRequest(text){return typeof text==='string'&&INTENT.test(text)}
function terms(input){return new Set((String(input).toLowerCase().match(/[a-z0-9]{3,}/g)||[]).filter(t=>!STOP.has(t)).slice(0,30))}
function safeFile(name){const lower=name.toLowerCase();return !SKIP_NAMES.has(lower)&&!lower.startsWith('.env')&&!/(?:secret|credential|password|private.key|\.pem$|\.pfx$|\.p12$|\.key$)/i.test(lower)&&EXT.has(path.extname(lower))}
function inside(root,file){return file.startsWith(root+path.sep)}
function boundedLine(line){if(/\b(?:token|secret|api[_-]?key|password|credential|private[_-]?key|authorization)\b\s*[:=]/i.test(line))return '[redacted possible credential]';return line.length>200?line.slice(0,197)+'...':line}

// Heuristic top-level function-span extraction (not an AST parser). Matches an
// explicitly named symbol and preserves contiguous source lines up to the budget.
function namedFunctionSpan(lines,query,filename){
  if(!/\b(?:function|method|class|def|source|code|review|explain|inspect)\b/i.test(query))return null;
  const matchers=[
    /^(?:(?:export|default|async)\s+)*function\s+([A-Za-z_$][\w$]*)\s*\(/,
    /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,
    /^(?:(?:export|default)\s+)*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/
  ];
  const names=new Set((query.match(/[A-Za-z_$][\w$]{3,}/g)||[]).map(x=>x.toLowerCase()));
  for(let i=0;i<lines.length;i++){
    let decl=null;
    for(const re of matchers){decl=lines[i].match(re);if(decl)break}
    if(!decl||!names.has(decl[1].toLowerCase()))continue;
    let end=i,closed=false;
    if(filename.toLowerCase().endsWith('.py')){
      end=lines.length-1;closed=true;
      for(let k=i+1;k<lines.length;k++)if(lines[k].trim()&&!/^\s/.test(lines[k])){end=k-1;break}
    }else{
      if(/;\s*$/.test(lines[i])&&!/\{\s*$/.test(lines[i])){closed=true}
      else for(let k=i+1;k<lines.length;k++){
        if(/^}\s*;?\s*$/.test(lines[k])){end=k;closed=true;break}
        if(k-i>=140)break;
      }
    }
    if(!closed)end=Math.min(lines.length-1,i+22);
    return {symbol:decl[1],start:i+1,end:end+1,complete:closed,
      source:lines.slice(i,end+1).map((line,j)=>String(i+j+1)+': '+boundedLine(line))};
  }
  return null;
}

export async function buildCodeContext(root,query,{maxChars=1000,maxFiles=140}={}){
  if(typeof query!=='string'||query.length>3000)throw new TypeError('Invalid coding query');
  if(!Number.isInteger(maxChars)||maxChars<100||maxChars>2400)throw new RangeError('Invalid code context budget');
  if(!Number.isInteger(maxFiles)||maxFiles<1||maxFiles>300)throw new RangeError('Invalid file scan limit');
  if(!isCodingRequest(query))return {context:'',files:[],estimated_tokens:0,inspected:0};
  const realRoot=await fs.realpath(root);const rootStat=await fs.lstat(realRoot);
  if(!rootStat.isDirectory())throw new TypeError('Repository root must be a directory');
  const todo=[realRoot],candidates=[];let seen=0,scannedBytes=0;
  const q=terms(query);
  while(todo.length&&seen<maxFiles&&scannedBytes<1_000_000){
    const dir=todo.shift();let entries;
    try{entries=await fs.readdir(dir,{withFileTypes:true})}catch{continue}
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){
      if(seen>=maxFiles||scannedBytes>=1_000_000)break;
      if(entry.isSymbolicLink())continue;
      const full=path.join(dir,entry.name);
      if(!inside(realRoot,full))continue;
      if(entry.isDirectory()){
        if(!SKIP_DIRS.has(entry.name.toLowerCase())&&path.relative(realRoot,full).split(path.sep).length<=4)todo.push(full);
        continue;
      }
      if(!entry.isFile()||!safeFile(entry.name))continue;
      const stat=await fs.lstat(full).catch(()=>null);
      if(!stat||!stat.isFile()||stat.size>48_000)continue;
      seen++;scannedBytes+=stat.size;
      const rel=path.relative(realRoot,full).replaceAll(path.sep,'/');
      let source;try{source=await fs.readFile(full,'utf8')}catch{continue}
      if(source.includes('\u0000'))continue;
      const lines=source.split(/\r?\n/).slice(0,450),basename=rel.toLowerCase();
      let score=0;
      for(const t of q){if(basename.includes(t))score+=8;else if(source.toLowerCase().includes(t))score+=1}
      if(query.toLowerCase().includes(rel.toLowerCase()))score+=30;
      const focus=namedFunctionSpan(lines,query,rel);
      if(focus)score+=100;
      if(!score)continue;
      let matches=[];
      for(let i=0;i<lines.length;i++){
        const lower=lines[i].toLowerCase();if([...q].some(t=>lower.includes(t))){matches.push(i);if(matches.length>=4)break}
      }
      if(matches.length===0)matches=[0];
      const snippet=matches.map(i=>String(i+1)+': '+boundedLine(lines[i])).join('\n');
      candidates.push({path:rel,score,fragment:'FILE '+rel+'\n'+snippet+'\n',focus});
    }
  }
  candidates.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
  const exact=candidates.find(c=>c.focus);
  if(exact){
    const f=exact.focus;
    const header='FILE '+exact.path+' SYMBOL '+f.symbol+' LINES '+f.start+'-'+f.end+'\n';
    const chunks=[header];let used=header.length,fit=0;
    for(const line of f.source){
      if(used+line.length+1>maxChars)break;
      chunks.push(line+'\n');used+=line.length+1;fit++;
    }
    const complete=f.complete&&fit===f.source.length;
    if(!complete){
      const marker='[SOURCE SPAN INCOMPLETE — request narrower scope]\n';
      while(used+marker.length>maxChars&&chunks.length>1)used-=chunks.pop().length;
      if(used+marker.length<=maxChars)chunks.push(marker);
    }
    const context=chunks.join('');
    return {context,files:[exact.path],focus_symbol:f.symbol,source_span_complete:complete,
      estimated_tokens:Math.ceil(Buffer.byteLength(context,'utf8')/3),inspected:seen,scanned_bytes:scannedBytes};
  }
  const fragments=[],files=[];let remaining=maxChars;
  for(const c of candidates){
    if(files.length>=3||remaining<80)break;
    const part=c.fragment.slice(0,remaining);
    if(part.length<50)break;
    fragments.push(part);files.push(c.path);remaining-=part.length+1;
  }
  const context=fragments.join('\n');
  return {context,files,estimated_tokens:Math.ceil(Buffer.byteLength(context,'utf8')/3),inspected:seen,scanned_bytes:scannedBytes};
}
