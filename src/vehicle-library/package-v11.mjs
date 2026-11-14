import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {libraryRoot,inspect,VEHICLES} from './v9.mjs';

const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const requirements=[
 {key:'manufacturer_sources',kind:'source',description:'Official vehicle manufacturer source documents'},
 {key:'cad',kind:'CAD',description:'Vehicle-specific 3D CAD assembly and dimensioned drawings'},
 {key:'wiring',kind:'Wiring',description:'HV/LV schematics and harness pinouts'},
 {key:'components',kind:'Components',description:'Traceable BOM and component specifications'},
 {key:'simulation',kind:'Simulations',description:'Verified powertrain and battery simulation results'},
 {key:'evidence',kind:'Evidence',description:'Independent engineering safety and test evidence'}
];
function safeId(id){return typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id);}
export function buildEngineeringPackage({root=libraryRoot(),vehicle='F-450',year=2026,id,output}={}){
 if(!VEHICLES.includes(vehicle)||!Number.isInteger(Number(year))||Number(year)<2000||Number(year)>2100||!safeId(id))throw Error('INVALID_CONFIGURATION');
 const config=inspect({root,vehicle,year}).configurations.find(c=>c.id===id);
 if(!config)throw Error('CONFIGURATION_NOT_FOUND');
 const dir=path.join(root,'Ford',vehicle,String(year)),sources=JSON.parse(fs.existsSync(path.join(dir,'Sources','manifest.json'))?fs.readFileSync(path.join(dir,'Sources','manifest.json'),'utf8'):'{"sources":[]}').sources;
 const records=[],holds=[];
 for(const sourceId of config.sourceIds){
  const s=sources.find(x=>x.id===sourceId);
  if(!s){holds.push('SOURCE_MANIFEST_MISSING:'+sourceId);continue;}
  const file=path.join(dir,'Sources',s.storedName);
  const valid=/^[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(s.storedName)&&fs.existsSync(file)&&sha(file)===s.sha256;
  records.push({kind:'source',name:s.originalName,sha256:s.sha256,verifiedHash:valid,manufacturerVerified:false,sourceUrl:s.sourceUrl||null});
  if(!valid)holds.push('SOURCE_HASH_MISMATCH:'+s.sha256);
 }
 for(const a of config.artifacts){
  if(!['CAD','Wiring','Components','Simulations','Evidence'].includes(a.kind)||!/^[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(a.storedName)){holds.push('INVALID_ARTIFACT_RECORD');continue;}
  const file=path.join(dir,a.kind,a.storedName),valid=fs.existsSync(file)&&sha(file)===a.sha256;
  records.push({kind:a.kind,name:a.originalName,sha256:a.sha256,verifiedHash:valid,sourceIds:a.sourceIds,engineeringApproved:false});
  if(!valid)holds.push('ARTIFACT_HASH_MISMATCH:'+a.sha256);
  for(const sourceId of a.sourceIds)if(!config.sourceIds.includes(sourceId))holds.push('UNLINKED_SOURCE:'+sourceId);
 }
 const coverage=requirements.map(r=>({requirement:r.key,description:r.description,hasArtifact:r.kind==='source'?config.sourceIds.length>0:config.artifacts.some(a=>a.kind===r.kind),validated:false}));
 for(const c of coverage)if(!c.hasArtifact)holds.push('MISSING_'+c.requirement.toUpperCase());
 holds.push('MANUFACTURER_GEOMETRY_UNVERIFIED','INDEPENDENT_ENGINEERING_APPROVAL_REQUIRED');
 const report={schema:'fun.engineering.package.v11',vehicle,year:Number(year),configurationId:id,geometryStatus:config.geometryStatus,engineeringApproved:false,manufacturingReady:false,coverage,records,holds:[...new Set(holds)]};
 if(output){const absolute=path.resolve(output);fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
 return report;
}
