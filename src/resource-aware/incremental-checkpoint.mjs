// RAEM-005: explicit, bounded synthetic event checkpoint store.
// No networking, automatic timers, AIL integration, or process control.
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,lstat,readFile,open,rename,unlink} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';

const SCHEMA='fun.raem.incremental.v1';
const ID=/^[a-z][a-z0-9_-]{1,47}$/;
const EVENT=/^[a-zA-Z0-9_.:-]{3,100}$/;
const CATEGORIES=new Set(['breach_report','ransomware_claim','exposure_notice','other']);
const isInt=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const digest=x=>createHash('sha256').update(x,'utf8').digest('hex');
const keys=(obj,allowed)=>Object.keys(obj).every(k=>allowed.includes(k));
function checkSpec(input){
 if(!plain(input)||!keys(input,['root','source','refreshHours','maxRecent']))throw Error('RAEM005_CONFIG_INVALID');
 const p={refreshHours:6,maxRecent:256,...input};
 if(typeof p.root!=='string'||!isAbsolute(p.root)||resolve(p.root)!==p.root||
  typeof p.source!=='string'||!ID.test(p.source)||!isInt(p.refreshHours,1,168)||!isInt(p.maxRecent,16,4096))throw Error('RAEM005_CONFIG_INVALID');
 return Object.freeze(p);
}
function validRecord(r){
 return plain(r)&&keys(r,['eventId','category'])&&typeof r.eventId==='string'&&EVENT.test(r.eventId)&&CATEGORIES.has(r.category);
}
function blank(spec){return {schema:SCHEMA,source:spec.source,refreshHours:spec.refreshHours,maxRecent:spec.maxRecent,cursor:0,lastSuccessMs:null,nextDueMs:0,seen:[],processedTotal:0,duplicateTotal:0};}
function validateState(s,p){
 if(!plain(s)||!keys(s,Object.keys(blank(p)))||Object.keys(s).length!==Object.keys(blank(p)).length||s.schema!==SCHEMA||s.source!==p.source||s.refreshHours!==p.refreshHours||s.maxRecent!==p.maxRecent||
 !isInt(s.cursor,0,Number.MAX_SAFE_INTEGER)||!(s.lastSuccessMs===null||isInt(s.lastSuccessMs,0,Number.MAX_SAFE_INTEGER))||!isInt(s.nextDueMs,0,Number.MAX_SAFE_INTEGER)||
 !Array.isArray(s.seen)||s.seen.length>p.maxRecent||new Set(s.seen).size!==s.seen.length||!s.seen.every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||
 !isInt(s.processedTotal,0,Number.MAX_SAFE_INTEGER)||!isInt(s.duplicateTotal,0,Number.MAX_SAFE_INTEGER))throw Error('RAEM005_CHECKPOINT_INVALID');
 return s;
}
async function assertSafeDir(dir){
 const parent=dirname(dir);
 if(parent!==dir){const st=await lstat(parent);if(!st.isDirectory()||st.isSymbolicLink())throw Error('RAEM005_PARENT_UNSAFE');}
 try{const st=await lstat(dir);if(!st.isDirectory()||st.isSymbolicLink())throw Error('RAEM005_STORE_UNSAFE');}
 catch(e){if(e?.code!=='ENOENT')throw e;await mkdir(dir,{recursive:false,mode:0o700});}
}
async function assertSafeFile(path){
 try{const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||st.size>524288)throw Error('RAEM005_FILE_UNSAFE');return true;}
 catch(e){if(e?.code==='ENOENT')return false;throw e;}
}
export class IncrementalCheckpointStore {
 #p;#path;#lock;
 constructor(config){this.#p=checkSpec(config);this.#path=join(this.#p.root,this.#p.source+'.json');this.#lock=join(this.#p.root,this.#p.source+'.lock');}
 async read(){
  await assertSafeDir(this.#p.root);
  if(!await assertSafeFile(this.#path))return blank(this.#p);
  let value;try{value=JSON.parse(await readFile(this.#path,'utf8'));}catch{throw Error('RAEM005_CHECKPOINT_INVALID');}
  return validateState(value,this.#p);
 }
 async processBatch({cursor,events,nowMs,operatorApproved=false}={}){
  if(!isInt(cursor,1,Number.MAX_SAFE_INTEGER)||!isInt(nowMs,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(events)||!isInt(events.length,1,64)||!events.every(validRecord))throw Error('RAEM005_BATCH_INVALID');
  if(operatorApproved!==true)return {state:'HOLD',reason:'OPERATOR_APPROVAL_REQUIRED'};
  await assertSafeDir(this.#p.root);
  let lock;
  try{lock=await open(this.#lock,'wx',0o600);}catch(e){if(e?.code==='EEXIST')return {state:'HOLD',reason:'OPERATION_LOCKED'};throw e;}
  let tmp=null;
  try{
   const current=await this.read();
   if(cursor<=current.cursor)return {state:'HOLD',reason:'CURSOR_REPLAY_OR_REGRESSION',cursor:current.cursor};
   if(nowMs<current.nextDueMs)return {state:'HOLD',reason:'REFRESH_NOT_DUE',nextDueMs:current.nextDueMs};
   const seen=new Set(current.seen),order=[...current.seen];
   let accepted=0,duplicates=0;
   for(const ev of events){
    const hash=digest(this.#p.source + String.fromCharCode(0) + ev.eventId);
    if(seen.has(hash)){duplicates++;continue;}
    accepted++;seen.add(hash);order.push(hash);
    if(order.length>this.#p.maxRecent){const oldest=order.shift();seen.delete(oldest);}
   }
   if(!isInt(nowMs+this.#p.refreshHours*3600000,0,Number.MAX_SAFE_INTEGER)||
      !isInt(current.processedTotal+accepted,0,Number.MAX_SAFE_INTEGER)||!isInt(current.duplicateTotal+duplicates,0,Number.MAX_SAFE_INTEGER))throw Error('RAEM005_COUNTER_LIMIT');
   const next={...current,cursor,seen:order,lastSuccessMs:nowMs,nextDueMs:nowMs+this.#p.refreshHours*3600000,
    processedTotal:current.processedTotal+accepted,duplicateTotal:current.duplicateTotal+duplicates};
   const encoded=JSON.stringify(next)+'\n';if(Buffer.byteLength(encoded)>524288)throw Error('RAEM005_STATE_TOO_LARGE');
   tmp=this.#path+'.'+randomBytes(8).toString('hex')+'.tmp';
   const f=await open(tmp,'wx',0o600);
   try{await f.writeFile(encoded,'utf8');await f.sync();}finally{await f.close();}
   // Atomic replacement on the same filesystem; prior checkpoint survives process crash before rename.
   await rename(tmp,this.#path);tmp=null;
   return {state:'PASS',reason:'CHECKPOINT_COMMITTED',cursor,accepted,duplicates,nextDueMs:next.nextDueMs,storedRecentHashes:order.length};
  }finally{
   if(tmp)await unlink(tmp).catch(()=>{});
   await lock.close();await unlink(this.#lock).catch(()=>{});
  }
 }
}
