// Fun Industrial native CAD/WireViz qualification V3.
// Probe is read-only. Render requires explicit, exact SHA-256 for both external tools.
// No installs, background daemons, ports, user shell, or other-project inspection.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,mkdirSync,readFileSync,writeFileSync,realpathSync,openSync,readSync,closeSync} from 'node:fs';
import {resolve,join,parse,sep,dirname} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';

const ID=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const HASH=/^[a-f0-9]{64}$/i;
function hold(code){throw Error('FUN_EV_NATIVE_'+code+'_HOLD');}
function sha(buffer){return createHash('sha256').update(buffer).digest('hex');}
function streamingSha(p){
 const h=createHash('sha256'),buff=Buffer.allocUnsafe(256*1024),fd=openSync(p,'r');
 try{let n;while((n=readSync(fd,buff,0,buff.length,null))>0)h.update(buff.subarray(0,n));}
 finally{closeSync(fd);}
 return h.digest('hex');
}
function within(root,p){const r=resolve(root),v=resolve(p);return v===r||v.startsWith(r+sep);}
function inspectDirs(p){
 let walk=parse(resolve(p)).root;
 for(const n of resolve(p).slice(walk.length).split(sep).filter(Boolean)){
  walk=join(walk,n);
  if(!existsSync(walk))return false;
  const st=lstatSync(walk);
  if(!st.isDirectory()||st.isSymbolicLink())hold('UNSAFE_DIRECTORY');
 }
 return true;
}
function checkedFile(p,max=150000000){
 const parent=dirname(p);
 if(!inspectDirs(parent))return null;
 try{
  const st=lstatSync(p);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)hold('UNSAFE_FILE');
  if(realpathSync(p)!==resolve(p))hold('REPARSE_TARGET');
  return {path:resolve(p),sha256:streamingSha(p),size_bytes:st.size};
 }catch(e){if(e.code==='ENOENT')return null;throw e;}
}
function base(){return process.env.LOCALAPPDATA||join(homedir(),'AppData','Local');}
function toolsRoot(){return join(base(),'FunIndustrial','EVEngineering','Tools');}
function projectRoot(){return join(base(),'FunIndustrial','EVEngineering','Prototypes');}
function programDirs(){
 return [...new Set([process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean).map(x=>resolve(x)))];
}
function candidates(){
 const tc=toolsRoot();
 const wireviz=[join(tc,'WireViz','venv','Scripts','wireviz.exe')];
 const graphviz=[];
 const freecad=[],qelectro=[];
 for(const parent of programDirs()){
  if(!inspectDirs(parent))continue;
  for(const entry of readdirSync(parent,{withFileTypes:true})){
   if(!entry.isDirectory()||entry.isSymbolicLink())continue;
   if(/^graphviz(?:[ -].*)?$/i.test(entry.name))graphviz.push(join(parent,entry.name,'bin','dot.exe'));
   if(/^freecad(?:[ -].*)?$/i.test(entry.name))
     freecad.push(join(parent,entry.name,'bin','FreeCAD.exe'),join(parent,entry.name,'FreeCAD.exe'));
   if(/^qelectrotech(?:[ -].*)?$/i.test(entry.name))
     qelectro.push(join(parent,entry.name,'bin','qelectrotech.exe'),join(parent,entry.name,'qelectrotech.exe'));
  }
 }
 return {wireviz,graphviz,freecad,qelectrotech:qelectro};
}
function probe(){
 const entries={};
 for(const [name,paths] of Object.entries(candidates())){
  const matches=[];
  for(const p of paths){const f=checkedFile(p);if(f)matches.push(f);}
  entries[name]={state:matches.length?'CANDIDATES_UNQUALIFIED':'NOT_FOUND_IN_SCOPED_PATHS',matches};
 }
 return {schema:'fun.ev.native-probe.v3',scope:'FUN_INDUSTRIAL_ONLY',
   execution:'NONE',installed_and_qualified:false,tools:entries};
}
function project(id){
 if(!ID.test(id||''))hold('BAD_ID');
 const root=projectRoot(),path=join(root,id);
 if(!inspectDirs(root)||!inspectDirs(path))hold('PROJECT_NOT_FOUND');
 return path;
}
function readJson(path){
 const f=checkedFile(path,65536);if(!f)hold('MISSING_MANIFEST');
 try{return JSON.parse(readFileSync(path,'utf8'))}catch{hold('BAD_JSON');}
}
function originalEvidence(id){
 const dir=project(id),out=join(dir,'output');
 if(!inspectDirs(out))hold('V2_OUTPUT_MISSING');
 const m=readJson(join(out,'manifest.json'));
 if(m.schema!=='fun.ev.prototype-export.v2'||m.project_id!==id||
  m.scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY'||
  m.production_released!==false||m.high_voltage_work_authorized!==false||
  m.engineering_approved!==false||m.external_tools_executed!==0||
  !Array.isArray(m.files)||m.files.length!==3)hold('V2_MANIFEST_INVALID');
 const required=new Set(['bench-plate.FCMacro','bench-harness.yml','bench-pinout.csv']);
 for(const f of m.files){
  if(!f||!required.delete(f.name)||!HASH.test(f.sha256||''))hold('V2_FILES_INVALID');
  const actual=checkedFile(join(out,f.name),1048576);
  if(!actual||actual.sha256!==f.sha256||actual.size_bytes!==f.size_bytes)hold('V2_FILE_CHANGED');
 }
 if(required.size)hold('V2_MISSING_FILE');
 const inp=checkedFile(join(dir,'prototype.json'),32768);
 if(!inp||inp.sha256!==m.input_sha256)hold('V2_INPUT_CHANGED');
 return {dir,out,m};
}
function render(id,wHash,dHash){
 if(!HASH.test(wHash||'')||!HASH.test(dHash||''))hold('OPERATOR_HASHES_REQUIRED');
 const {dir,out}=originalEvidence(id),found=probe();
 const wireviz=found.tools.wireviz.matches.find(x=>x.sha256.toLowerCase()===wHash.toLowerCase());
 const dot=found.tools.graphviz.matches.find(x=>x.sha256.toLowerCase()===dHash.toLowerCase());
 if(!wireviz||!dot)hold('PINNED_NATIVE_TOOL_UNAVAILABLE');
 const dest=join(dir,'native-wireviz-v3');
 if(existsSync(dest))hold('NATIVE_OUTPUT_EXISTS');
 mkdirSync(dest);
 const env={...process.env,
  PATH:[dirname(dot.path),dirname(wireviz.path),
   join(process.env.SystemRoot||'C:\\Windows','System32')].join(sep==='\\'?';':':'),
  PYTHONNOUSERSITE:'1',PYTHONPATH:'',PYTHONHOME:''};
 const args=['-f','st','-o',dest,'-O','bench-harness',join(out,'bench-harness.yml')];
 // No shell, no downloads, pinned executable. The native library may spawn pinned dot via PATH.
 const result=spawnSync(wireviz.path,args,{cwd:dest,env,shell:false,windowsHide:true,
  timeout:30000,maxBuffer:1024*1024,encoding:'utf8'});
 if(result.error||result.status!==0)hold(result.error?.code==='ETIMEDOUT'?'TIMEOUT':'RENDER_FAILED');
 const paths=[join(dest,'bench-harness.svg'),join(dest,'bench-harness.bom.tsv')];
 const rendered=paths.map(p=>{
  const f=checkedFile(p,1048576);if(!f)hold('OUTPUT_MISSING');
  return {name:p.endsWith('.svg')?'bench-harness.svg':'bench-harness.bom.tsv',sha256:f.sha256,size_bytes:f.size_bytes};
 });
 const svg=readFileSync(paths[0],'utf8');
 if(!/<svg(?:\s|>)/i.test(svg)||/<script\b|<foreignObject\b|(?:href|xlink:href)=["'](?:https?:|file:)/i.test(svg))hold('SVG_UNTRUSTED');
 const manifest={schema:'fun.ev.native-render.v3',project_id:id,source_scope:'UNPOWERED_NON_VEHICLE_BENCH_ONLY',
  state:'NATIVE_RENDERED_ENGINEERING_HOLD',production_released:false,
  high_voltage_work_authorized:false,engineering_approved:false,
  native_wireviz_executable_sha256:wireviz.sha256,graphviz_dot_sha256:dot.sha256,
  v2_manifest_sha256:sha(readFileSync(join(out,'manifest.json'))),files:rendered};
 writeFileSync(join(dest,'native-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {schema:manifest.schema,state:manifest.state,project_id:id,files_rendered:2,
  output_dir:dest,tool_execution:'OPERATOR_HASH_PINNED',engineering_approved:false};
}
function main(args){
 if(args.length===1&&args[0]==='probe')return probe();
 if(args.length===4&&args[0]==='render')return render(args[1],args[2],args[3]);
 hold('USAGE');
}
try{process.stdout.write(JSON.stringify(main(process.argv.slice(2)),null,2)+'\n');}
catch(e){process.stderr.write(String(e.message||e)+'\n');process.exitCode=1;}
