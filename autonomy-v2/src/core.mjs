import { appendFileSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const HOME=process.env.FI_AUTONOMY_HOME||fileURLToPath(new URL("../",import.meta.url));
export const DATA=join(HOME,"data");
export function ensureData(){mkdirSync(DATA,{recursive:true})}
export function dataPath(name){if(!/^[a-z0-9_.-]{1,80}$/i.test(name))throw Error("INVALID_DATA_NAME");return join(DATA,name)}
export function readJSON(name,fallback=null){try{return JSON.parse(readFileSync(dataPath(name),"utf8"))}catch(e){if(e.code==="ENOENT")return fallback;throw e}}
export function atomicJSON(name,value){ensureData();const file=dataPath(name),tmp=file+".tmp-"+process.pid+"-"+Math.random().toString(36).slice(2);writeFileSync(tmp,JSON.stringify(value,null,2),"utf8");renameSync(tmp,file)}
export function logEvent(stage,details={}){ensureData();appendFileSync(dataPath("events.jsonl"),JSON.stringify({at:new Date().toISOString(),stage,...JSON.parse(JSON.stringify(details))})+"\n")}
export function events(max=75){let s="";try{s=readFileSync(dataPath("events.jsonl"),"utf8")}catch(e){if(e.code!=="ENOENT")throw e}return s.trim().split("\n").filter(Boolean).slice(-max).map(line=>{try{return JSON.parse(line)}catch{return {stage:"invalid-log-record"}}}).reverse()}
export function hash(x){return createHash("sha256").update(typeof x==="string"?x:JSON.stringify(x)).digest("hex")}
export function safeText(x,max=300){return String(x??"").slice(0,max).replace(/[\u0000-\u001f\u007f]/g," ")}
export function checkGithubUrl(value){const u=new URL(value);if(u.protocol!=="https:"||u.hostname!=="api.github.com"||u.port||u.username||u.password||!/^\/repos\/[a-z\d_.-]+\/[a-z\d_.-]+\/releases\/latest$/i.test(u.pathname)||u.search||u.hash)throw Error("RESEARCH_URL_NOT_ALLOWLISTED");return u.href}
export function classifyRea(tool){const n=String(tool?.name||""),d=String(tool?.description||"").toLowerCase();const risk=/^(execute|install|start|stop|update|set|patch|write|delete|remove|create|rename|annotate|inject|attach|detach|open|close|build|apply|edit|run|launch|invoke|clear|reset|train)(_|$)/i.test(n)||/may mutate|writes? |write a |modif(?:y|ies)|device-mutating|execute .*command|spawn .*process/i.test(d);return {name:safeText(n,120),requiresReview:risk,required:Array.isArray(tool?.inputSchema?.required)?tool.inputSchema.required.slice(0,30):[],schemaHash:hash(tool?.inputSchema||{})}}
export function statusAssessment(x){const tools=Number(x?.tools),enabled=Number(x?.enabled);return {ready:tools===229&&enabled===229&&x?.unified==="ready",reaTools:tools,reaEnabled:enabled,unified:safeText(x?.unified),consistent:tools===enabled}}
export function detectResearchChange(prev,next){return !prev||prev.tag!==next.tag||prev.publishedAt!==next.publishedAt}
export async function fetchJson(url,timeout=12000){const r=await fetch(url,{headers:{"user-agent":"FunIndustrial-AutonomyV2/1.0",accept:"application/vnd.github+json"},signal:AbortSignal.timeout(timeout),redirect:"error"});if(!r.ok)throw Error("HTTP_"+r.status);const raw=await r.text();if(raw.length>1800000)throw Error("RESPONSE_TOO_LARGE");return JSON.parse(raw)}
export async function localGet(path){if(!/^\/api\/(rea\/(tools|catalog)|unified\/status)$/.test(path))throw Error("FORBIDDEN_LOCAL_PATH");const r=await fetch("http://127.0.0.1:8789"+path,{signal:AbortSignal.timeout(15000),redirect:"error"});if(!r.ok)throw Error("LOCAL_HTTP_"+r.status+"_"+path);const raw=await r.text();if(raw.length>4000000)throw Error("LOCAL_RESPONSE_TOO_LARGE");return JSON.parse(raw)}
export function pendingTask(input){const title=safeText(input.title,140),detail=safeText(input.detail,450),kind=safeText(input.kind,40),at=new Date().toISOString(),id=hash(kind+"|"+title+"|"+detail).slice(0,24);const db=readJSON("pending-tasks.json",[]);if(!Array.isArray(db))throw Error("TASK_DB_INVALID");if(!db.some(t=>t.id===id)){db.push({id,kind,title,detail,at,status:"operator_review"});atomicJSON("pending-tasks.json",db.slice(-300));logEvent("followup_recorded",{id,title,kind})}return id}
