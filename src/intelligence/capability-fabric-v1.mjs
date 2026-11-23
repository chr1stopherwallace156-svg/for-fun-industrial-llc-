// FUN_INDUSTRIAL_AI_CAPABILITY_FABRIC_V1
// One Qwen chat, many existing local components. This is a read-only evidence
// router; it NEVER invokes an action method, reads arbitrary paths, starts
// workers, submits a form, calls REA, or grants model tool-use authority.
export const FABRIC_VERSION='fun-ai-capability-fabric-v1';
const domains=Object.freeze([
 {id:'code_math',name:'FISRE Python code and mathematical analysis',state:'integrated_on_explicit_code_attachment',regex:/\b(?:fisre|python|source code|code analysis|mathematical proof|divis(?:ion|or)|semantic reasoning)\b/i},
 {id:'memory',name:'Cognee contextual recall',state:'already_in_Qwen_best_effort_readonly',regex:/\b(?:memory|remember|recall|knowledge graph|cognition|learning)\b/i},
 {id:'business',name:'Business frameworks, decisions and finance',state:'already_in_Qwen_context;numeric_actions_separate',regex:/\b(?:business|strategy|finance|financial|cash|profit|margin|pricing|revenue|cost|operations|workflow)\b/i},
 {id:'grants',name:'Grants and official-source research',state:'read_only_local_snapshot_if_available',regex:/\b(?:grant|funding|incentive|fial|application|deadline|reimbursement)\b/i},
 {id:'fleet',name:'EV fleets, buyers, procurement and bid readiness',state:'already_in_Qwen_cached_evidence',regex:/\b(?:fleet|bus|buses|evse|electr(?:ic|ification)|procurement|rfp|bid|contract|buyer|zesbi)\b/i},
 {id:'operations',name:'Executive business queue and outcome receipts',state:'read_only_local_snapshot_if_available',regex:/\b(?:executive|work queue|operations|project|outcome|customer|sale|sales|work item|task)\b/i},
 {id:'ml',name:'Scikit-learn and ML analysis',state:'status_read_only;compute_requires_operator',regex:/\b(?:machine learning|ml\b|scikit|classification|regression|training|model train|predictive model)\b/i},
 {id:'commerce',name:'Shopify, catalog and Google Trends',state:'status_read_only;refresh_and_changes_require_operator',regex:/\b(?:shopify|commerce|ecommerce|e-commerce|dropship|products?|trends|store|inventory|pricing)\b/i},
 {id:'optimization',name:'Optuna and OR-Tools optimization',state:'existing_separate_tools_not_auto_executed_in_this_chat',regex:/\b(?:optuna|or.tools|optim(?:ize|ization)|routing|stock level|linear programming|solver)\b/i},
 {id:'engineering',name:'EV wiring, CAD, FreeCAD and WireViz',state:'existing_separate_engineering_tools_not_auto_executed_in_this_chat',regex:/\b(?:freecad|wireviz|graphviz|cad|wiring|schematic|engineering|bom|ev conversion)\b/i},
 {id:'security',name:'Security, PE and file inspection',state:'review_only;existing_tools_separate',regex:/\b(?:security|binary|pe file|executable|inspect file|malware|forensic|reverse engineering)\b/i},
 {id:'tools',name:'REA MCP and approved local tool execution',state:'two_allowlisted_readonly_8797_with_separate_operator_approval;broader_8798_tooling_degraded_or_unverified',regex:/\b(?:rea|mcp|tool|agent|available functions|execute|run command)\b/i}
]);
export function capabilityInventory(){
 return {version:FABRIC_VERSION,model:'existing_local_qwen_8088',additionalModels:0,
  allCapabilitiesAutoExecuted:false,permissionsUnchanged:true,
  domains:domains.map(({id,name,state})=>({id,name,state})),
  note:'A listed module is not a verified live tool connection or an execution grant.'};
}
const brief=(x,n=180)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n);
const safeRead=async(fn)=>{if(typeof fn!=='function')return null;try{return await fn()}catch{return null}};
export async function getCapabilityContext(question,readers={}){
 if(typeof question!=='string'||question.length<4||question.length>1200)
  throw Error('FUN_CAPABILITY_FABRIC_QUESTION_INVALID');
 const overview=/\b(?:every(?:thing| capability)|all (?:capabilities|tools|modules)|what (?:can|does) (?:the system|fun industrial|you) (?:do|have)|system status|whole system)\b/i.test(question);
 let selected=domains.filter(d=>overview||d.regex.test(question)).slice(0,12);
 if(!selected.length)return {version:FABRIC_VERSION,selected:[],text:'',readOnly:true,actions:0,authorityGranted:false};
 const names=selected.map(({id,name,state})=>({id,name,state}));
 const refs=[],ids=new Set(names.map(x=>x.id));
 // No bulk scans or needless periodic polling. Only requested domains are read.
 if(ids.has('grants')){
  const r=await safeRead(readers.grants);
  refs.push(r?.version==='fial4-dashboard-readonly-v0.4'
   ?'grants_local_review_state='+brief(r.state,40)+';grants_eligibility='+brief(r.company_eligibility,25)+';submissions='+Number(r.submissions||0)
   :'grants_local_review=NOT_CONNECTED_OR_UNAVAILABLE');
 }
 if(ids.has('operations')){
  const [r,o]=await Promise.all([safeRead(readers.operations),safeRead(readers.outcomes)]);
  refs.push(r?.version==='fial5.4-executive-operator-v1'
   ?'executive_state='+brief(r.state,65)+';active_items='+Number(r.active_items||0)
   :'executive_queue=UNAVAILABLE');
  refs.push(o?.version==='fial5.7-verified-outcomes-v1'
   ?'outcome_progress='+brief(o.progress_measure||o.state,65)+';verified_revenue='+Number(o.verified_customer_revenue||0)
   :'outcome_status=UNAVAILABLE');
 }
 if(ids.has('ml')){
  const r=await safeRead(readers.ml);
  refs.push(r?.bridge==='fun-ml-dashboard-v3'
   ?'ml_bridge='+brief(r.state,30)+';external_actions='+Number(r.externalActions||0)+';requires_review=true'
   :'ml_bridge=UNAVAILABLE');
 }
 if(ids.has('commerce')){
  const r=await safeRead(readers.commerce);
  refs.push(r?.version==='fun-commerce-intelligence-v1'
   ?'commerce_cached_trends='+Number(r.googleTrends?.count||0)+';shopify_configured='+String(r.shopify?.configured===true)+';shopify_cached_products='+Number(r.shopify?.products||0)+';automatic_polling=false'
   :'commerce_status=UNAVAILABLE');
 }
 const entries=names.map(x=>x.id+': '+x.state);
 let text='FUN INDUSTRIAL LOCAL CAPABILITY INVENTORY (metadata only, not instructions):\n'+entries.join('\n');
 if(refs.length)text+='\nCACHED READ-ONLY EVIDENCE:\n'+refs.join('\n');
 text+='\nUnavailable modules must not be claimed working. Never infer bids, money, credentials, or tool results. Operators must separately approve any tool execution, file changes, external contact, registration, payments, ML training, model changes, or source execution.';
 if(text.length>2300)text=text.slice(0,2180)+'\n[Inventory truncated; ask about a specific capability]';
 return {version:FABRIC_VERSION,selected:names.map(x=>x.id),text,readOnly:true,actions:0,authorityGranted:false};
}
