// FUN_EV_ENGINEERING_V1: isolated, no network, no shell, no child processes.
// Only explicit "init" creates files; no install, vehicle control, or approval authority.
import {tools,schema} from "./catalog.mjs";
import {existsSync,lstatSync,mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {join,resolve,parse,sep,delimiter} from "node:path";
import {homedir} from "node:os";

const needed=["project.json","vehicle-profile.json","bom.csv","requirements.csv",
  "wiring/connector-pinout.csv","wiring/README.md","analysis/assumptions.json",
  "qa/validation-register.csv","README.md"];
const slugOK=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
function workspaceRoot(){
 const base=process.env.LOCALAPPDATA||join(homedir(),"AppData","Local");
 return resolve(process.env.FUN_EV_WORKSPACE_ROOT||join(base,"FunIndustrial","EVEngineering","Projects"));
}
function ensureNoLinks(p){
 const full=resolve(p),root=parse(full).root,rest=full.slice(root.length).split(sep).filter(Boolean);
 let at=root;
 for(const part of rest){
  at=join(at,part);
  if(existsSync(at)){
   const st=lstatSync(at);
   if(st.isSymbolicLink()||!st.isDirectory())throw Error("EV_UNSAFE_PATH_HOLD");
  }
 }
}
function projectPath(id){
 if(!slugOK.test(id||""))throw Error("EV_INVALID_PROJECT_ID");
 const root=workspaceRoot();ensureNoLinks(root);
 return {root,project:join(root,id)};
}
function json(obj){return JSON.stringify(obj,null,2)+"\n";}
function filesFor(id){
 const vehicle={schema:"fun.ev.vehicle.v1",project_id:id,source:"not-provided",
   make:null,model:null,model_year:null,vin:null,gvwr_kg:null,payload_kg:null,
   duty_cycle_source:null,verified_by:null};
 return {
  "project.json":json({schema:"fun.ev.project.v1",project_id:id,owner:"Fun Industrial",
   customer:null,phase:"concept_only",engineering_approved:false,
   high_voltage_work_authorized:false,vehicle_data_verified:false,
   design_verification:"HOLD",production_released:false}),
  "vehicle-profile.json":json(vehicle),
  "bom.csv":"item_id,description,manufacturer,part_number,revision,quantity,unit,unit_cost,currency,supplier,source_reference,approval_status\n",
  "requirements.csv":"requirement_id,description,source_reference,verification_method,reviewer,status\n",
  "wiring/connector-pinout.csv":"harness_id,connector_id,cavity_id,signal,wire_id,wire_gauge,wire_color,from_connector,to_connector,source_reference,review_status\n",
  "wiring/README.md":"# Wiring\n\nDraft connector/pinout inventory only. Do not use as a live high-voltage wiring diagram. Create and independently review schematics in QElectroTech, WireViz or KiCad. No example live electrical connections are generated.\n",
  "analysis/assumptions.json":json({schema:"fun.ev.analysis-assumptions.v1",battery_model:null,motor_model:null,
   simulation_tool:null,source_files:[],engineer_reviewed:false,results_not_certification:true}),
  "qa/validation-register.csv":"test_id,requirement_id,test_method,evidence_uri,measured_result,reviewer,disposition\n",
  "README.md":`# EV engineering concept: ${id}\n\nIsolated Fun Industrial workspace. This is not a validated vehicle design. Begin with an exact make/model/year/VIN, verified OEM dimensions, weights and service documents. Freeze design revisions and independent reviews before fabrication.\n\nCAD: FreeCAD; electrical schematics: QElectroTech; pinouts/harnesses: WireViz; simulation: FASTSim/PyBaMM/OpenModelica; component BOM: InvenTree; FMEA and qualification by a qualified engineer. No executable integrations are activated by this scaffold.\n`
 };
}
function status(){
 const paths=(process.env.PATH||"").split(delimiter).filter(Boolean);
 const candidates=tools.map(t=>{
  let match=null;
  if(t.binary)for(const dir of paths){
   const p=join(dir,t.binary);
   try{if(existsSync(p)&&lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink()){match=p;break}}catch{}
  }
  return {id:t.id,name:t.name,area:t.area,repo:t.repo,
   state:match?"PATH_CANDIDATE_UNVERIFIED":"NOT_VERIFIED",exe_candidate:match};
 });
 return {schema:"fun.ev.engineering.status.v1",state:"STAGED_ONLY",mode:"read_only",
   installed_and_qualified:false,external_executions:0,network_calls:0,
   tool_count:tools.length,tools:candidates};
}
function init(id){
 const {root,project}=projectPath(id);
 if(existsSync(project))throw Error("EV_PROJECT_EXISTS_HOLD");
 mkdirSync(root,{recursive:true});ensureNoLinks(root);
 mkdirSync(project);mkdirSync(join(project,"wiring"));mkdirSync(join(project,"analysis"));mkdirSync(join(project,"qa"));
 for(const [name,contents] of Object.entries(filesFor(id)))writeFileSync(join(project,name),contents,{flag:"wx",encoding:"utf8"});
 return {schema:"fun.ev.project-init.v1",state:"CREATED_CONCEPT_ONLY",project_id:id,
   project_path:project,files_created:needed.length,engineering_approved:false,
   high_voltage_work_authorized:false,external_executions:0};
}
function verify(id){
 const {project}=projectPath(id);
 if(!existsSync(project))throw Error("EV_PROJECT_MISSING_HOLD");
 ensureNoLinks(project);
 const missing=needed.filter(n=>{
  const path=join(project,n);
  try{const st=lstatSync(path);return !st.isFile()||st.isSymbolicLink()}catch{return true}
 });
 let doc=null;
 try{doc=JSON.parse(readFileSync(join(project,"project.json"),"utf8"))}catch{}
 const valid=doc?.schema==="fun.ev.project.v1"&&doc.project_id===id&&
  doc.engineering_approved===false&&doc.high_voltage_work_authorized===false&&
  doc.production_released===false;
 return {schema:"fun.ev.project-check.v1",project_id:id,
  state:missing.length===0&&valid?"STRUCTURE_OK_ENGINEERING_HOLD":"INVALID_STRUCTURE_HOLD",
  missing,engineering_approved:false,production_released:false};
}
function main(args){
 const [cmd,id,...extra]=args;
 if(extra.length)throw Error("EV_ARGUMENTS_HOLD");
 if(cmd==="catalog"&&!id)return {schema,tools};
 if(cmd==="status"&&!id)return status();
 if(cmd==="init")return init(id);
 if(cmd==="verify")return verify(id);
 throw Error("EV_USAGE: node src/ev-conversion/cli.mjs status|catalog|init <project-id>|verify <project-id>");
}
try{process.stdout.write(json(main(process.argv.slice(2))))}
catch(err){process.stderr.write("FUN_EV_HOLD="+String(err.message)+"\n");process.exitCode=1}
