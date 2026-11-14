// Fun Industrial EV V8 FreeCAD preflight: read-only discovery and source qualification.
// No installation, FreeCAD execution, file writes, service or other-project operations.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,realpathSync} from 'node:fs';
import {resolve,join,dirname,parse,sep} from 'node:path';
const ID=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
function hold(s){throw Error('FUN_EV_V8_'+s+'_HOLD');}
function safeDir(p){
 let walk=parse(resolve(p)).root;
 for(const seg of resolve(p).slice(walk.length).split(sep).filter(Boolean)){
  walk=join(walk,seg);
  if(!existsSync(walk))hold('MISSING_DIRECTORY');
  const st=lstatSync(walk);
  if(!st.isDirectory()||st.isSymbolicLink())hold('UNSAFE_DIRECTORY');
 }
}
function safeFile(p,max){
 safeDir(dirname(p));
 let st;try{st=lstatSync(p);}catch{hold('MISSING_FILE');}
 if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max||realpathSync(p)!==resolve(p))hold('UNSAFE_FILE');
 return readFileSync(p);
}
function discover(){
 const candidates=[];
 for(const parent of [process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean)){
  if(!existsSync(parent))continue;
  safeDir(parent);
  for(const entry of readdirSync(parent,{withFileTypes:true})){
   if(!entry.isDirectory()||entry.isSymbolicLink()||!/^FreeCAD(?:[ -].*)?$/i.test(entry.name))continue;
   for(const name of ['bin/FreeCAD.exe','FreeCAD.exe','bin/FreeCADCmd.exe','bin/FreeCADGui.exe']){
    const path=join(parent,entry.name,...name.split('/'));
    if(!existsSync(path))continue;
    const bytes=safeFile(path,200000000);
    candidates.push({path,sha256:sha(bytes),size_bytes:bytes.length,qualified:false});
   }
  }
 }
 return candidates;
}
function preflight(id){
 if(!ID.test(id||''))hold('BAD_PROJECT_ID');
 const local=process.env.LOCALAPPDATA;
 if(!local)hold('LOCALAPPDATA_REQUIRED');
 const root=join(local,'FunIndustrial','EVEngineering','Prototypes',id);
 safeDir(root);
 const v2=JSON.parse(safeFile(join(root,'output','manifest.json'),65536).toString('utf8'));
 if(v2.schema!=='fun.ev.prototype-export.v2'||v2.project_id!==id||
    v2.scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY'||v2.production_released!==false||
    v2.engineering_approved!==false||v2.high_voltage_work_authorized!==false||
    v2.external_tools_executed!==0||!Array.isArray(v2.files)||v2.files.length!==3)hold('V2_MANIFEST');
 const entry=v2.files.find(x=>x.name==='bench-plate.FCMacro');
 if(!entry||!/^[0-9a-f]{64}$/i.test(entry.sha256||''))hold('MACRO_MANIFEST');
 const macro=safeFile(join(root,'output','bench-plate.FCMacro'),65536);
 if(sha(macro)!==entry.sha256||macro.length!==entry.size_bytes)hold('MACRO_DIGEST');
 const input=safeFile(join(root,'prototype.json'),32768);
 if(sha(input)!==v2.input_sha256)hold('INPUT_DIGEST');
 const spec=JSON.parse(input.toString('utf8'));
 if(spec.schema!=='fun.ev.prototype.v2'||spec.scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY')hold('INPUT_SCOPE');
 const p=spec.plate;
 if(!p||!Array.isArray(p.holes)||p.holes.length>12||
    ![p.width_mm,p.depth_mm,p.thickness_mm].every(Number.isFinite)||
    p.width_mm<30||p.width_mm>500||p.depth_mm<30||p.depth_mm>500||
    p.thickness_mm<1||p.thickness_mm>20)hold('PLATE_BOUNDS');
 for(const h of p.holes){
  if(![h.x_mm,h.y_mm,h.diameter_mm].every(Number.isFinite)||
    h.diameter_mm<2||h.diameter_mm>20||
    h.x_mm-h.diameter_mm/2<1||h.x_mm+h.diameter_mm/2>p.width_mm-1||
    h.y_mm-h.diameter_mm/2<1||h.y_mm+h.diameter_mm/2>p.depth_mm-1)hold('HOLE_BOUNDS');
 }
 for(let i=0;i<p.holes.length;i++)for(let j=i+1;j<p.holes.length;j++){
  const a=p.holes[i],b=p.holes[j];
  if(Math.hypot(a.x_mm-b.x_mm,a.y_mm-b.y_mm)<=(a.diameter_mm+b.diameter_mm)/2+1)hold('HOLE_OVERLAP');
 }
 const expected=[
  '# Fun Industrial V2 synthetic, non-vehicle bench geometry only.',
  '# Open in FreeCAD GUI via Macro menu. Does not save, export or operate machinery.',
  'import FreeCAD as App','import Part',
  'doc = App.newDocument("FI_BENCH_'+id.replaceAll('-','_')+'")',
  'shape = Part.makeBox('+p.width_mm+', '+p.depth_mm+', '+p.thickness_mm+')'
 ];
 for(const h of p.holes)expected.push('shape = shape.cut(Part.makeCylinder('+(h.diameter_mm/2)+', '+p.thickness_mm+', App.Vector('+h.x_mm+', '+h.y_mm+', 0)))');
 expected.push('obj = doc.addObject("Part::Feature", "BenchPlate")','obj.Shape = shape','doc.recompute()','print("Fun Industrial bench geometry created; UNSUITABLE FOR VEHICLE FABRICATION")');
 if(macro.toString('utf8').replace(/\r\n/g,'\n')!==expected.join('\n')+'\n')hold('MACRO_SOURCE_MISMATCH');
 const cutVolume=p.holes.reduce((sum,h)=>sum+Math.PI*(h.diameter_mm/2)**2*p.thickness_mm,0);
 const found=discover();
 return {schema:'fun.ev.freecad.preflight.v8',scope:'FUN_INDUSTRIAL_ONLY',mode:'READ_ONLY',
   project_id:id,state:found.length?'FREECAD_CANDIDATE_UNQUALIFIED':'FREECAD_NOT_FOUND_IN_SCOPED_PATHS',
   v2_macro_sha256:sha(macro),v2_manifest_sha256:sha(safeFile(join(root,'output','manifest.json'),65536)),
   dimensions_mm:{width:p.width_mm,depth:p.depth_mm,thickness:p.thickness_mm},
   holes_checked:p.holes.length,expected_volume_mm3:p.width_mm*p.depth_mm*p.thickness_mm-cutVolume,
   freecad_candidates:found,freecad_executed:false,files_written:0,network_calls:0,
   engineering_approved:false,production_released:false,high_voltage_work_authorized:false};
}
try{
 if(process.argv.length!==4||process.argv[2]!=='preflight')hold('USAGE');
 console.log(JSON.stringify(preflight(process.argv[3]),null,2));
}catch(e){console.error(e.message||e);process.exitCode=1;}
