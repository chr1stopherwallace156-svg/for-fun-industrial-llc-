// Fun Industrial EV V7: local, read-only verification of the native bench SVG and BOM.
// No network, process spawning, installs, project writes or engineering approval.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import {resolve,join,dirname,parse,sep} from 'node:path';

const ID=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const HEX=/^[a-f0-9]{64}$/i;
const PIN=/^[A-Za-z][A-Za-z0-9_+-]{0,19}$/;
const COLORS=new Set(['BK','RD','GN','YE','BU','WH','GY','BN','OG','VT','PK']);
const realBench={
  id:'bench-4d5012c1',
  v2_manifest_sha256:'9977163abb171192e764f150a66de00a87847bc03cfc3cac22e4d775df214acc',
  wireviz_sha256:'97dd00935e88831fff6a231bf3bfa44ff5d5f90e35050024b587919555062f13',
  dot_sha256:'97193dc802c145b6152cecc287e84e459160839964d9340f4f10b93d96087601',
  svg_sha256:'fbb8bbff9cbfca2f5c19fc04c965623caa35af728802d3627aa8a77b9479afca',
  bom_sha256:'cb23ceea14fc9288a56a512ac9fa64e9f1f42101425989c139461bf4c28f96f4'
};
function hold(reason){throw Error('FUN_EV_V7_'+reason+'_HOLD');}
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function same(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase();}
function directory(path){
 const full=resolve(path);
 let part=parse(full).root;
 for(const seg of full.slice(part.length).split(sep).filter(Boolean)){
  part=join(part,seg);
  if(!existsSync(part))hold('MISSING_DIRECTORY');
  const st=lstatSync(part);
  if(!st.isDirectory()||st.isSymbolicLink())hold('UNSAFE_DIRECTORY');
 }
}
function file(path,max){
 directory(dirname(path));
 let st;
 try{st=lstatSync(path);}catch{hold('MISSING_FILE');}
 if(!st.isFile()||st.isSymbolicLink()||st.size===0||st.size>max)hold('UNSAFE_FILE');
 if(realpathSync(path)!==resolve(path))hold('REPARSE_FILE');
 return readFileSync(path);
}
function json(bytes){
 try{return JSON.parse(bytes.toString('utf8'));}catch{hold('INVALID_JSON');}
}
function keys(object,wanted){
 if(!object||typeof object!=='object'||Array.isArray(object))hold('OBJECT_SCHEMA');
 if(Object.keys(object).some(x=>!wanted.includes(x)))hold('UNKNOWN_FIELD');
 for(const k of wanted)if(!Object.hasOwn(object,k))hold('MISSING_FIELD');
}
function numbered(n,min,max){
 if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)hold('INVALID_NUMBER');
}
function verifyMeta(m,id,isNative){
 if(m.project_id!==id||m.engineering_approved!==false||
   m.high_voltage_work_authorized!==false||m.production_released!==false)hold('AUTHORITY_BOUNDARY');
 if(isNative){
  if(m.schema!=='fun.ev.native-render.v3'||m.source_scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY'||
     m.state!=='NATIVE_RENDERED_ENGINEERING_HOLD'||!HEX.test(m.v2_manifest_sha256||'')||
     !HEX.test(m.native_wireviz_executable_sha256||'')||!HEX.test(m.graphviz_dot_sha256||''))hold('NATIVE_META');
 }else{
  if(m.schema!=='fun.ev.prototype-export.v2'||m.scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY'||
     m.status!=='UNQUALIFIED_NON_VEHICLE_BENCH'||m.external_tools_executed!==0||
     !HEX.test(m.input_sha256||''))hold('V2_META');
 }
}
function entryMap(manifest,expected){
 if(!Array.isArray(manifest.files)||manifest.files.length!==expected.length)hold('FILE_LIST');
 const out=new Map();
 for(const r of manifest.files){
  if(!r||!expected.includes(r.name)||out.has(r.name)||!HEX.test(r.sha256||'')||
    !Number.isSafeInteger(r.size_bytes)||r.size_bytes<1||r.size_bytes>1048576)hold('FILE_ENTRY');
  out.set(r.name,r);
 }
 return out;
}
function readExpected(root,folder,m,names){
 const entries=entryMap(m,names),ret={};
 for(const name of names){
  const bytes=file(join(root,folder,name),1048576),meta=entries.get(name);
  if(bytes.length!==meta.size_bytes||!same(digest(bytes),meta.sha256))hold('FILE_DIGEST');
  ret[name]=bytes.toString('utf8');
 }
 return ret;
}
function validateSpec(p){
 keys(p,['schema','scope','plate','harness']);
 if(p.schema!=='fun.ev.prototype.v2'||p.scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY')hold('INPUT_SCOPE');
 keys(p.plate,['width_mm','depth_mm','thickness_mm','holes']);
 const pl=p.plate;
 numbered(pl.width_mm,30,500);numbered(pl.depth_mm,30,500);numbered(pl.thickness_mm,1,20);
 if(!Array.isArray(pl.holes)||pl.holes.length>12)hold('GEOMETRY');
 keys(p.harness,['x1_pinlabels','x2_pinlabels','cable']);
 const h=p.harness;
 if(!Array.isArray(h.x1_pinlabels)||!Array.isArray(h.x2_pinlabels)||
   h.x1_pinlabels.length<2||h.x1_pinlabels.length>8||
   h.x1_pinlabels.length!==h.x2_pinlabels.length)hold('PINS');
 for(const pins of [h.x1_pinlabels,h.x2_pinlabels]){
  if(pins.some(x=>typeof x!=='string'||!PIN.test(x))||new Set(pins).size!==pins.length)hold('PIN_LABEL');
 }
 keys(h.cable,['gauge_mm2','length_m','colors']);
 numbered(h.cable.gauge_mm2,0.1,2.5);numbered(h.cable.length_m,0.1,10);
 if(!Array.isArray(h.cable.colors)||h.cable.colors.length!==h.x1_pinlabels.length||
    h.cable.colors.some(x=>!COLORS.has(x)))hold('WIRE_COLOR');
 return h;
}
function csvAudit(csv,spec){
 const lines=csv.trimEnd().split(/\r?\n/);
 const expected='cable_id,wire_index,from_connector,from_pin,to_connector,to_pin,color,review_status';
 if(lines[0]!==expected||lines.length!==spec.x1_pinlabels.length+1)hold('PINOUT_SHAPE');
 for(let i=0;i<spec.cable.colors.length;i++){
  const expectedRow=['W1',i+1,'X1',i+1,'X2',i+1,spec.cable.colors[i],'NOT_ENGINEER_REVIEWED'].join(',');
  if(lines[i+1]!==expectedRow)hold('PINOUT_MISMATCH');
 }
}
function yamlAudit(yaml,spec,id){
 // This audit accepts ONLY the bounded V2-generated wire format, not arbitrary YAML.
 const n=spec.x1_pinlabels.length,indices=Array.from({length:n},(_,i)=>i+1).join(', ');
 const expected=[
  '# Fun Industrial V2 - synthetic, unpowered bench example. NOT vehicle wiring.',
  'metadata:','  title: "Fun Industrial Bench Harness '+id+'"',
  'connectors:','  X1:','    type: "Bench test connector"',
  '    pinlabels: ['+spec.x1_pinlabels.join(', ')+']',
  '  X2:','    type: "Bench test connector"',
  '    pinlabels: ['+spec.x2_pinlabels.join(', ')+']',
  'cables:','  W1:','    category: bundle',
  '    gauge: '+spec.cable.gauge_mm2+' mm2',
  '    length: '+spec.cable.length_m,
  '    colors: ['+spec.cable.colors.join(', ')+']',
  'connections:','  -','    - X1: ['+indices+']',
  '    - W1: ['+indices+']',
  '    - X2: ['+indices+']'
 ].join('\n')+'\n';
 if(yaml.replace(/\r\n/g,'\n')!==expected)hold('HARNESS_SOURCE_MISMATCH');
 return n;
}
function decodeEntities(s){
 return s.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hx,dec)=>{
   const code=parseInt(hx||dec,hx?16:10);
   return Number.isSafeInteger(code)&&code<=0x10ffff?String.fromCodePoint(code):'';
 }).replace(/&(?:amp|lt|gt|quot|apos);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[x]);
}
function svgAudit(svg,spec){
 if(svg.length<200||svg.length>1048576||!/<svg\b/.test(svg)||
   !/<\/svg>/.test(svg)||!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg))hold('SVG_FORMAT');
 if(/<\s*(?:script|foreignObject|iframe)\b|on(?:load|error|click)\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|file:|javascript:)/i.test(svg))hold('SVG_ACTIVE_CONTENT');
 const titles=[...svg.matchAll(/<title>([\s\S]*?)<\/title>/g)].map(m=>decodeEntities(m[1]));
 const words=[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>decodeEntities(m[1].replace(/<[^>]*>/g,'')));
 const values=new Set([...titles,...words].map(x=>x.trim()).filter(Boolean));
 for(const name of ['X1','X2','W1',...spec.x1_pinlabels,...spec.x2_pinlabels]){
  if(!values.has(name))hold('SVG_LABEL_ABSENT');
 }
 return {svg_labels_checked:new Set(['X1','X2','W1',...spec.x1_pinlabels,...spec.x2_pinlabels]).size};
}
function bomAudit(tsv,spec){
 const lines=tsv.trimEnd().split(/\r?\n/);
 if(lines[0]!=='Id\tDescription\tQty\tUnit\tDesignators'||lines.length<2||lines.length>16)hold('BOM_FORMAT');
 const connectors=new Set(),conductorColors=new Set(),items=[];
 const expectedColors=new Set(spec.cable.colors);
 if(expectedColors.size!==spec.cable.colors.length)hold('BOM_AMBIGUOUS_CONDUCTOR_COLORS');
 const gauge=String(spec.cable.gauge_mm2);
 for(const line of lines.slice(1)){
  const fields=line.split('\t');
  if(fields.length!==5)hold('BOM_COLS');
  const [item,description,qtyRaw,unit,designatorsRaw]=fields;
  if(!/^[0-9]{1,2}$/.test(item)||!description.trim()||!/^\d+(?:\.\d+)?$/.test(qtyRaw))hold('BOM_ITEM');
  const qty=Number(qtyRaw),designators=designatorsRaw.split(/,\s*/).filter(Boolean);
  if(!Number.isFinite(qty)||qty<=0||designators.length<1)hold('BOM_QTY');
  if(designators.includes('W1')){
   if(designators.length!==1||designators[0]!=='W1'||unit!=='m'||
     Math.abs(qty-spec.cable.length_m)>0.00001)hold('BOM_CABLE_QUANTITY');
   // Native WireViz emits one W1 row per conductor color, not one cable row.
   // Validate exact color and gauge rather than allowing arbitrary repeated W1 rows.
   const m=/^Wire,\s*([0-9]+(?:\.[0-9]+)?)\s*mm(?:²|\u00c2²|2),\s*([A-Z]{2})$/.exec(description.trim());
   if(!m||Number(m[1])!==Number(gauge)||!expectedColors.has(m[2])||
      conductorColors.has(m[2]))hold('BOM_CONDUCTOR_MISMATCH');
   conductorColors.add(m[2]);
  }else{
   if(unit.trim()!==''||qty!==designators.length)hold('BOM_CONNECTOR_QUANTITY');
   if(!/^Connector,\s*Bench test connector,\s*[0-9]+\s+pins$/.test(description.trim()))hold('BOM_CONNECTOR_DESCRIPTION');
   if(Number(description.trim().match(/([0-9]+)\s+pins$/)[1])!==spec.x1_pinlabels.length)hold('BOM_CONNECTOR_PINS');
   for(const d of designators){
    if(!['X1','X2'].includes(d)||connectors.has(d))hold('BOM_DESIGNATOR');
    connectors.add(d);
   }
  }
  items.push({designators,qty,unit});
 }
 if(connectors.size!==2||!connectors.has('X1')||!connectors.has('X2'))hold('BOM_MISSING_COMPONENT');
 if(conductorColors.size!==expectedColors.size)hold('BOM_MISSING_CONDUCTOR');
 return {bom_rows_checked:items.length,designators_checked:connectors.size+1,conductor_colors_checked:conductorColors.size};
}
function main(args){
 if(args.length!==2||args[0]!=='audit'||!ID.test(args[1]||''))hold('USAGE');
 if(!process.env.LOCALAPPDATA)hold('LOCALAPPDATA_REQUIRED');
 const id=args[1];
 const dir=join(process.env.LOCALAPPDATA,'FunIndustrial','EVEngineering','Prototypes',id);
 directory(dir);
 const v2Raw=file(join(dir,'output','manifest.json'),65536);
 const v2=json(v2Raw);verifyMeta(v2,id,false);
 const nativeRaw=file(join(dir,'native-wireviz-v3','native-manifest.json'),65536);
 const native=json(nativeRaw);verifyMeta(native,id,true);
 if(!same(digest(v2Raw),native.v2_manifest_sha256))hold('MANIFEST_LINEAGE');
 const inp=file(join(dir,'prototype.json'),32768);
 if(!same(digest(inp),v2.input_sha256))hold('INPUT_DIGEST');
 const spec=validateSpec(json(inp));
 const sources=readExpected(dir,'output',v2,['bench-plate.FCMacro','bench-harness.yml','bench-pinout.csv']);
 const outputs=readExpected(dir,'native-wireviz-v3',native,['bench-harness.svg','bench-harness.bom.tsv']);
 const n=yamlAudit(sources['bench-harness.yml'],spec,id);
 csvAudit(sources['bench-pinout.csv'],spec);
 const visual=svgAudit(outputs['bench-harness.svg'],spec);
 const bom=bomAudit(outputs['bench-harness.bom.tsv'],spec);
 if(id===realBench.id){
  if(!same(digest(v2Raw),realBench.v2_manifest_sha256)||
     !same(native.native_wireviz_executable_sha256,realBench.wireviz_sha256)||
     !same(native.graphviz_dot_sha256,realBench.dot_sha256)||
     !same(digest(Buffer.from(outputs['bench-harness.svg'],'utf8')),realBench.svg_sha256)||
     !same(digest(Buffer.from(outputs['bench-harness.bom.tsv'],'utf8')),realBench.bom_sha256))hold('BENCH_RECORDED_EVIDENCE_MISMATCH');
 }
 return {schema:'fun.ev.native-artifact-audit.v7',scope:'FUN_INDUSTRIAL_ONLY',
   mode:'READ_ONLY',project_id:id,state:'ARTIFACT_INTEGRITY_AND_STRUCTURAL_LABELS_PASS_ENGINEERING_HOLD',
   input_and_lineage_sha256_verified:true,native_output_sha256_verified:true,
   pinout_rows_checked:n,svg_labels_checked:visual.svg_labels_checked,
   bom_rows_checked:bom.bom_rows_checked,bom_designators_checked:bom.designators_checked,
   electrical_continuity_measured:false,independent_visual_review:false,
   production_released:false,engineering_approved:false,high_voltage_work_authorized:false,
   files_written:0,external_tools_executed:0};
}
try{process.stdout.write(JSON.stringify(main(process.argv.slice(2)),null,2)+'\n');}
catch(e){process.stderr.write(String(e.message||e)+'\n');process.exitCode=1;}
