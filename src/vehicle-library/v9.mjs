import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const VEHICLES = Object.freeze(['F-450','F-550','E-450']);
const SECTIONS = ['Sources','Configurations','CAD','Wiring','Components','Simulations','Evidence','Graph'];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const safe = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(s) && s !== '..';
const fail = message => { throw new Error(message); };
export function libraryRoot() { return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'),'FunIndustrial','VehicleLibrary'); }
function vehicleDir(root,vehicle,year) {
  if (!VEHICLES.includes(vehicle) || !Number.isInteger(Number(year)) || Number(year)<2000 || Number(year)>2100) fail('INVALID_VEHICLE_OR_YEAR');
  return path.join(root,'Ford',vehicle,String(year));
}
function atomicJSON(filename,data) {
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  const temp=filename+'.'+crypto.randomUUID()+'.tmp';
  try { fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n',{flag:'wx'}); fs.renameSync(temp,filename); }
  finally { if(fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function readJSON(filename,fallback) { return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename,'utf8')) : fallback; }
export function init({root=libraryRoot(),year=2026}={}) {
  for(const vehicle of VEHICLES) for(const section of SECTIONS) fs.mkdirSync(path.join(vehicleDir(root,vehicle,year),section),{recursive:true});
  fs.mkdirSync(path.join(root,'_Shared','Indexes'),{recursive:true});
  return {state:'LIBRARY_READY',root,vehicles:VEHICLES,year};
}
function registryFile(root,vehicle,year) { return path.join(vehicleDir(root,vehicle,year),'Configurations','registry.json'); }
export function register({root=libraryRoot(),vehicle,year=2026,id,cab='unspecified',wheelbase='unverified'}={}) {
  if(!safe(id)) fail('INVALID_CONFIGURATION_ID');
  const file=registryFile(root,vehicle,year);
  const db=readJSON(file,{schema:'fun.vehicle.v9',vehicle,year:Number(year),configurations:[]});
  if(db.configurations.some(c=>c.id===id)) fail('CONFIGURATION_ALREADY_EXISTS');
  const config={id,vehicle,year:Number(year),cab,wheelbase,geometryStatus:'UNVERIFIED',engineeringApproved:false,sourceIds:[],artifacts:[],createdAt:new Date().toISOString()};
  db.configurations.push(config); atomicJSON(file,db);
  return config;
}
function configOf(root,vehicle,year,id) {
  const file=registryFile(root,vehicle,year),db=readJSON(file,null);
  if(!db) fail('REGISTRY_MISSING');
  const config=db.configurations.find(c=>c.id===id);
  if(!config) fail('CONFIGURATION_NOT_FOUND');
  return {file,db,config};
}
function fileHash(filename) {
  const bytes=fs.readFileSync(filename); return {sha256:hash(bytes),bytes:bytes.length};
}
export function importSource({root=libraryRoot(),vehicle,year=2026,id,file,sourceUrl=null}={}) {
  const {file:regFile,db,config}=configOf(root,vehicle,year,id);
  if(!fs.statSync(file).isFile()) fail('SOURCE_NOT_FILE');
  const ext=path.extname(file).toLowerCase();
  if(!['.pdf','.step','.stp','.dxf','.dwg','.txt','.json'].includes(ext)) fail('UNSUPPORTED_SOURCE_EXTENSION');
  const original=path.basename(file),info=fileHash(file);
  const target=path.join(vehicleDir(root,vehicle,year),'Sources',info.sha256+ext);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  if(!fs.existsSync(target)) fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);
  if(fileHash(target).sha256!==info.sha256) fail('SOURCE_COPY_HASH_MISMATCH');
  const source={id:info.sha256,originalName:original,storedName:path.basename(target),sha256:info.sha256,bytes:info.bytes,sourceUrl,importedAt:new Date().toISOString(),verifiedContent:false};
  if(!config.sourceIds.includes(source.id)) config.sourceIds.push(source.id);
  const manifest=path.join(vehicleDir(root,vehicle,year),'Sources','manifest.json');
  const data=readJSON(manifest,{schema:'fun.sources.v9',sources:[]});
  if(!data.sources.some(s=>s.id===source.id)) data.sources.push(source);
  atomicJSON(manifest,data);atomicJSON(regFile,db);
  return source;
}
export function attachArtifact({root=libraryRoot(),vehicle,year=2026,id,file,kind,sourceIds=[]}={}) {
  if(!['CAD','Wiring','Components','Simulations','Evidence'].includes(kind)) fail('INVALID_ARTIFACT_KIND');
  const {file:regFile,db,config}=configOf(root,vehicle,year,id);
  if(!fs.statSync(file).isFile()) fail('ARTIFACT_NOT_FILE');
  if(!sourceIds.every(s=>config.sourceIds.includes(s))) fail('UNKNOWN_SOURCE_REFERENCE');
  const info=fileHash(file),ext=path.extname(file).toLowerCase(),name=info.sha256+ext;
  const dest=path.join(vehicleDir(root,vehicle,year),kind,name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(!fs.existsSync(dest)) fs.copyFileSync(file,dest,fs.constants.COPYFILE_EXCL);
  if(fileHash(dest).sha256!==info.sha256) fail('ARTIFACT_COPY_HASH_MISMATCH');
  const artifact={id:info.sha256,kind,originalName:path.basename(file),storedName:name,sha256:info.sha256,sourceIds,engineeringApproved:false};
  if(!config.artifacts.some(a=>a.id===artifact.id&&a.kind===kind)) config.artifacts.push(artifact);
  atomicJSON(regFile,db);
  return artifact;
}
export function graph({root=libraryRoot(),vehicle,year=2026}={}) {
  const db=readJSON(registryFile(root,vehicle,year),{configurations:[]});
  const nodes=new Map(),edges=[];
  const add=(id,type,label)=>nodes.set(id,{id,type,label});
  const vehicleId='vehicle:'+vehicle+':'+year;add(vehicleId,'vehicle',vehicle+' '+year);
  for(const c of db.configurations){
    const cid='config:'+c.id;add(cid,'configuration',c.id);edges.push({from:vehicleId,to:cid,type:'HAS_CONFIGURATION'});
    for(const s of c.sourceIds){const sid='source:'+s;add(sid,'source',s);edges.push({from:cid,to:sid,type:'SUPPORTED_BY'});}
    for(const a of c.artifacts){const aid='artifact:'+a.kind+':'+a.id;add(aid,'artifact',a.originalName);edges.push({from:cid,to:aid,type:'HAS_ARTIFACT'});for(const s of a.sourceIds)edges.push({from:aid,to:'source:'+s,type:'DERIVED_FROM'});}
  }
  const result={schema:'fun.graph.v9',nodes:[...nodes.values()],edges};
  atomicJSON(path.join(vehicleDir(root,vehicle,year),'Graph','graph.json'),result);
  return result;
}
export function inspect({root=libraryRoot(),vehicle,year=2026}={}) {
  return readJSON(registryFile(root,vehicle,year),{schema:'fun.vehicle.v9',vehicle,year:Number(year),configurations:[]});
}
