// FI_ADAPTIVE_CAPABILITY_PLANNER_V2
// Operator-triggered, *informational* live capability planning: 229 REA MCP
// definitions + 19 existing local functions. No model-authored tool calls,
// code execution, provider initialization, file inspection or durable memory.
// Tool descriptions / schemas are untrusted catalog data, never authority.

const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const short=(x,n=170)=>String(x??'').replace(/[\u0000-\u001f\u007f]+/g,' ')
 .replace(/\s+/g,' ').trim().slice(0,n);
const hold=x=>{throw Error('ADAPTIVE_PLAN_'+x)};
const STOP=new Set(['the','and','this','that','with','your','from','into','using','need','want',
 'please','tools','tool','capabilities','capability','find','show','list','what','which',
 'could','would','should','might','have','are','can','for','about','help','able','available',
 'analyze','analysis','inspect','examine','understand','check','how','get','there','after',
 'before','make','build','use','run','execute','system','industrial','fun','rea','mcp',
 'possible','software','application','program']);
const normalized=x=>String(x??'').toLowerCase().replace(/[_./:()-]+/g,' ').replace(/[^a-z0-9 ]+/g,' ');
const tokens=x=>[...new Set(normalized(x).split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)))].slice(0,32);

export function validateLiveRegistry({reaStatus,reaCatalogue,localRegistry,localStatus}={}){
 const errors=[];
 const reaReady=reaStatus?.liveMcpHealth==='ready'&&reaStatus?.realReaToolCount===229;
 const localReady=localStatus?.sidecar===true&&localRegistry?.local_tool_count===19;
 const allRea=reaCatalogue?.tools;
 const allLocal=localRegistry?.tools;
 const records=[], names=new Set();
 if(!reaReady)errors.push('REA_PROVIDER_STATUS_NOT_VERIFIED');
 else if(!Array.isArray(allRea)||allRea.length!==229)errors.push('REA_229_CATALOGUE_NOT_VERIFIED');
 else {
  for(const item of allRea){
   if(!obj(item)||typeof item.name!=='string'||!item.name.trim()||
      item.name.length>140||names.has('rea:'+item.name)||
      !obj(item.inputSchema)||item.inputSchema.type!=='object'||
      JSON.stringify(item.inputSchema).length>16000){
    errors.push('REA_TOOL_DEFINITIONS_INVALID');break;
   }
   names.add('rea:'+item.name);
  }
  if(!errors.includes('REA_TOOL_DEFINITIONS_INVALID')){
   for(const item of allRea)records.push(normalizeDefinition(item,'rea'));
  }
 }
 if(!localReady)errors.push('LOCAL_19_REGISTRY_NOT_VERIFIED');
 else if(!Array.isArray(allLocal)||allLocal.length>320)errors.push('LOCAL_CATALOGUE_INVALID');
 else {
  const subset=allLocal.filter(t=>typeof t?.function?.name==='string'&&t.function.name.startsWith('fi_'));
  if(subset.length!==19)errors.push('LOCAL_19_NAME_COUNT_INVALID');
  else {
   for(const item of subset){
    const fn=item.function;
    if(item.type!=='function'||!/^[a-z][a-z0-9_]{2,100}$/.test(fn.name)||
       !obj(fn.parameters)||fn.parameters.type!=='object'||
       names.has('local:'+fn.name)||JSON.stringify(fn.parameters).length>16000){
      errors.push('LOCAL_TOOL_DEFINITIONS_INVALID');break;
    }
    names.add('local:'+fn.name);
   }
   if(!errors.includes('LOCAL_TOOL_DEFINITIONS_INVALID')){
    for(const item of subset)records.push(normalizeDefinition(item.function,'local'));
   }
  }
 }
 return Object.freeze({records:Object.freeze(records),errors:Object.freeze(errors),
  reaCount:records.filter(x=>x.source==='rea').length,
  localCount:records.filter(x=>x.source==='local').length,
  toolExecutionGrants:0});
}
function normalizeDefinition(item,source){
 const schema=source==='rea'?item.inputSchema:item.parameters;
 const req=Array.isArray(schema.required)?schema.required:
   schema.required===undefined?[]:null;
 const required=req&&req.length<=32&&req.every(x=>typeof x==='string'&&x.length<=90)
  ?req:null;
 return Object.freeze({name:item.name,source,description:short(item.description,220),
  required,requiresInputs:required===null||required.length>0,
  // We cannot infer harmlessness or provider readiness from names/descriptions.
  providerVerified:false,operationVerified:false,executionAllowed:false});
}
function categorize(prompt){
 const text=normalized(prompt);
 if(/\b(graph|tensor|neural|compute|matrix|simulation|training|pytorch)\b/.test(text))
  return 'local_compute';
 if(/\b(rust|binary|executable|dll|elf|apk|reverse engineering|decompiler|frida|android|ghidra|hopper)\b/.test(text))
  return 'rea_analysis';
 if(/\b(url|webpage|website|web site|https)\b/.test(text))
  return 'public_web';
 if(/\b(iphone|ios|warzone|game|games|mobile port)\b/.test(text))
  return 'game_app_feasibility';
 return 'general';
}
const aliases={
 executable:['binary','file','executable'],
 binaries:['binary'], file:['document','artifact'],
 rust:['rust'], graph:['graph'], matrix:['tensor'],
 iphone:['ios','apple'], ios:['iphone','apple'],
 game:['game'], website:['web','url','page']
};
function rank(record,query){
 const queryTokens=tokens(query);
 const name=tokens(record.name);
 const desc=tokens(record.description);
 let nameMatches=0,descMatches=0,score=0;
 for(const token of queryTokens){
  const variants=[token,...(aliases[token]||[])];
  if(variants.some(w=>name.includes(w))){nameMatches++;score+=12}
  else if(variants.some(w=>desc.includes(w))){descMatches++;score+=2}
 }
 return {record,score,nameMatches,descMatches};
}
export function buildAdaptivePlan({prompt,reaStatus,reaCatalogue,localRegistry,localStatus}={}){
 if(typeof prompt!=='string'||prompt.trim().length<5||prompt.length>1500)
  hold('PROMPT_INVALID');
 const observed=validateLiveRegistry({reaStatus,reaCatalogue,localRegistry,localStatus});
 const category=categorize(prompt);
 const ranked=observed.records.map(r=>rank(r,prompt)).filter(x=>x.score>=10&&x.nameMatches>=1)
  .sort((a,b)=>b.score-a.score||b.nameMatches-a.nameMatches||
    a.record.name.localeCompare(b.record.name)).slice(0,5);
 const matches=ranked.map(x=>{
  const r=x.record;
  return {name:r.name,source:r.source,description:r.description,score:x.score,
   requiredArguments:r.required,providerVerified:false,operationVerified:false,
   executionAllowed:false,operatorApprovalRequired:true,
   prerequisites:[
    ...(r.required===null?['input_schema_requires_independent_validation']:
      r.required.length?['supply_valid_arguments:'+r.required.join(',')]:[]),
    ...(r.source==='rea'?['verify_specific_REA_provider_and_target']:
      ['verify_local_tool_prerequisites']),
    'operator_approve_exact_tool_and_arguments_before_execution'
   ]};
 });
 const missing=[];
 if(category==='public_web')missing.push('A specific public HTTPS URL is required for live static page inspection');
 if(category==='rea_analysis')missing.push('An authorized, accessible target artifact and compatible analysis provider are needed to inspect a real binary');
 if(category==='game_app_feasibility')missing.push('A game title alone does not provide executable binaries, source or permissions; a compatibility assessment is not a working port');
 if(observed.reaCount!==229)missing.push('REA 229 live catalogue unavailable or unverified');
 if(observed.localCount!==19)missing.push('Local 19 live registry unavailable or unverified');
 if(!matches.length)missing.push('No sufficiently matched live tool name; do not substitute a vaguely related capability');
 const response={version:'fi-adaptive-capability-plan-v2',state:observed.errors.length?'partial_discovery':'planned_no_execution',
  category,task:short(prompt,900),catalogue:{rea:observed.reaCount,local:observed.localCount},
  candidates:matches,prerequisites:missing.slice(0,6),
  discoveryErrors:observed.errors,executedActions:0,approvalGranted:false,
  policy:'Catalogues are untrusted metadata. Discovery never grants authority or proves target/provider availability.',
  nextStep:matches.length?'Review a named candidate, verify its schema and target, then explicitly authorize a separate bounded action':'Provide a concrete target or additional evidence before choosing any tool'};
 return Object.freeze(response);
}
export function summarizeAdaptivePlan(plan){
 if(!obj(plan)||!Array.isArray(plan.candidates))hold('PLAN_INVALID');
 const available=plan.catalogue||{};
 const lines=[
  'Live capability discovery (no execution): '+String(available.rea||0)+' REA and '+String(available.local||0)+' local registrations verified.',
  'Task category: '+short(plan.category,65)+'.'
 ];
 if(plan.candidates.length){
  lines.push('Potential tool matches (NOT yet provider-qualified):');
  for(const tool of plan.candidates){
   lines.push('• '+short(tool.name,140)+' ['+short(tool.source,30)+']'+
    (Array.isArray(tool.requiredArguments)&&tool.requiredArguments.length?
     ' — required: '+tool.requiredArguments.map(x=>short(x,70)).join(', '):' — no declared required fields')+
    '. Operator approval and prerequisite checks still required.');
  }
 }else lines.push('No sufficiently matched tool found. No tool was substituted or executed.');
 if(plan.prerequisites.length)lines.push('Blockers: '+plan.prerequisites.join(' | '));
 if(plan.discoveryErrors.length)lines.push('Discovery holds: '+plan.discoveryErrors.join(', '));
 lines.push('Next: '+plan.nextStep+'.');
 return lines.join('\n').slice(0,3900);
}
export function createAdaptivePlanner({request}={}){
 if(typeof request!=='function')hold('REQUEST_REQUIRED');
 const REA='http://127.0.0.1:8797',LOCAL='http://127.0.0.1:8796',
  PARENT='http://127.0.0.1:8789';
 async function plan(prompt){
  const endpoints=[
   REA+'/api/rea229/status',REA+'/api/rea229/tools?limit=229',
   PARENT+'/api/ai/tools',LOCAL+'/api/ai/auto-local/status'
  ];
  const results=await Promise.allSettled(endpoints.map(url=>request(url)));
  const get=i=>results[i].status==='fulfilled'?results[i].value:null;
  const out=buildAdaptivePlan({prompt,reaStatus:get(0),reaCatalogue:get(1),
   localRegistry:get(2),localStatus:get(3)});
  return {...out,reply:summarizeAdaptivePlan(out)};
 }
 return Object.freeze({plan});
}
