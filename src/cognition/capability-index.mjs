// FI_CAPABILITY_INDEX_V1 — bounded informational discovery, never tool execution.
// Read existing fixed Fun Industrial definitions and REA catalogue ONLY if REA is ready.
// No writes, auto-start, REA calls, approval grants, or automatic action chaining.
const validName = name => typeof name==='string' && /^[A-Za-z0-9_.:/-]{2,128}$/.test(name);
const object = x => !!x && typeof x==='object' && !Array.isArray(x);
const compact = (s,n=160) => typeof s==='string'
 ? s.replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n) : '';
const words = str => [...new Set((str.toLowerCase().match(/[a-z][a-z0-9_]{2,}/g)||[]).filter(w=>!['this','that','with','from','into','would','could','should','please','have','your','about','these','which','where','when','what','there','their','more','some','give','need','using','tool','tools','capability','capabilities'].includes(w)))];
const normalize = (name,description,source) => {
 if(!validName(name))return null;
 return Object.freeze({name,description:compact(description),source,
  access:source==='rea'?'catalogue_only_execution_disabled':'operator_approved_only',
  healthVerified:false, executableByModel:false});
};
function dedupe(list,source,seen,limit){
 if(!Array.isArray(list)||list.length>limit)throw Error('CAPABILITY_CATALOGUE_SIZE_INVALID_'+source);
 const out=[];
 for(const item of list){
  const name=source==='rea'?'rea__'+item?.name:item?.function?.name;
  const description=source==='rea'?item?.description:item?.function?.description;
  const record=normalize(name,description,source);
  if(!record)continue;
  if(seen.has(name))throw Error('CAPABILITY_DUPLICATE_NAME');
  seen.add(name);out.push(record);
 }
 return out;
}
const rank = (record,queryTokens) => {
 const name=record.name.toLowerCase().replace(/^rea__/,'').replace(/[^a-z0-9]+/g,' ');
 const description=record.description.toLowerCase();
 let score=0;
 for(const token of queryTokens){
  if(name.includes(token))score+=5;
  else if(description.includes(token))score+=1;
 }
 return score;
};
export function createCapabilityIndex({localDefinitions,reaCatalogue}={}){
 if(typeof localDefinitions!=='function'||typeof reaCatalogue!=='function')
  throw Error('CAPABILITY_INDEX_CALLBACKS_REQUIRED');
 let cachedRea=[],state='not_loaded',lastError=null,loads=0;
 function local(){
  const seen=new Set();
  return {records:dedupe(localDefinitions(),'local',seen,64),seen};
 }
 async function refreshRea(){
  // An explicit catalogue refresh is read-only and never initializes the REA MCP process.
  let response;
  try{response=await reaCatalogue();}
  catch(_){cachedRea=[];state='unavailable';lastError='rea_catalogue_unavailable';return status();}
  try{
   const records=Array.isArray(response)?response:Array.isArray(response?.tools)?response.tools:null;
   if(!records)throw Error('REA_CATALOGUE_MALFORMED');
   const seen=local().seen;
   const next=dedupe(records,'rea',seen,256);
   cachedRea=next;state='available_catalogue_only';lastError=null;loads++;
  }catch(_){cachedRea=[];state='invalid';lastError='rea_catalogue_invalid';}
  return status();
 }
 function status(){
  return Object.freeze({version:'fi-capability-index-v1',localCount:local().records.length,
   reaCatalogued:cachedRea.length,reaState:state,reaError:lastError,
   reaRefreshes:loads,modelExecutionEnabled:false,automaticReaInitialization:false,
   automaticToolCalls:false,executionGrants:0,availableSourceCount:2});
 }
 function search({query,limit=6,budgetChars=1200}={}){
  if(typeof query!=='string'||query.length<2||query.length>1000||!/\S/.test(query))
   throw Error('CAPABILITY_QUERY_INVALID');
  if(!Number.isSafeInteger(limit)||limit<1||limit>12)throw Error('CAPABILITY_LIMIT_INVALID');
  if(!Number.isSafeInteger(budgetChars)||budgetChars<250||budgetChars>2400)
   throw Error('CAPABILITY_BUDGET_INVALID');
  const tokens=words(query);
  const all=[...local().records,...cachedRea];
  const scored=all.map(r=>({r,score:rank(r,tokens)})).filter(x=>x.score>0)
   .sort((a,b)=>b.score-a.score||a.r.name.localeCompare(b.r.name));
  let used=0;const matches=[];
  for(const entry of scored){
   if(matches.length>=limit)break;
   const r=entry.r;
   const minimal={name:r.name,source:r.source,description:r.description,
    access:r.access,healthVerified:false,executableByModel:false};
   const cost=JSON.stringify(minimal).length;
   if(cost>budgetChars-used)continue;
   matches.push(minimal);used+=cost;
  }
  return {query:compact(query,256),matches,matchedTotal:scored.length,
   resultChars:used,budgetChars,reaState:state,reaCatalogued:cachedRea.length,
   includesRea:matches.some(x=>x.source==='rea'),permissionsChanged:false,
   modelExecutionEnabled:false,requiresOperatorApproval:true,
   note:'Informational discovery only; catalogue entries do not grant execution authority.'};
 }
 return Object.freeze({status,refreshRea,search});
}
