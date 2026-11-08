// Deterministic, read-only situational decisions. No LLM, tool invocation or eval().
import rulesPackage from "json-rules-engine";
const {Engine}=rulesPackage;
const RULE_VERSION="fi-situational-v1";
const decision=(code,priority,condition)=>({
 conditions:condition,priority,event:{type:code,params:{code}}
});
const eq=(fact,value)=>({fact,operator:"equal",value});
const includes=(fact,values)=>({fact,operator:"in",value:values});
const POLICY=Object.freeze([
 decision("HOLD_EMERGENCY_STOP",100,{all:[eq("emergency_stop",true)]}),
 decision("HOLD_REA_EXECUTION_FORBIDDEN",95,{all:[eq("mode","execute"),eq("rea_tool_requested",true)]}),
 decision("HOLD_EXECUTION_FORBIDDEN",92,{all:[eq("mode","execute")]}),
 decision("HOLD_RISK_HIGH",90,{all:[includes("risk_level",["high","critical","unknown"])]}),
 decision("HOLD_UNTRUSTED_EVIDENCE",85,{all:[eq("source_trusted",false)]}),
 decision("HOLD_INCOMPLETE_CONTEXT",80,{all:[eq("context_complete",false)]}),
 decision("HOLD_SERVICE_UNAVAILABLE",75,{all:[eq("service_ready",false)]}),
 decision("HOLD_EVIDENCE_UNVERIFIED",70,{all:[eq("evidence_verified",false)]}),
 decision("PROPOSE_FOR_OPERATOR_REVIEW",20,{all:[
  eq("mode","propose"),eq("emergency_stop",false),eq("source_trusted",true),
  eq("context_complete",true),eq("service_ready",true),eq("evidence_verified",true),
  includes("risk_level",["low","medium"])
 ]}),
 decision("OBSERVE_BOUNDED",10,{all:[
  eq("mode","observe"),eq("emergency_stop",false),eq("source_trusted",true),
  eq("context_complete",true),eq("service_ready",true),eq("evidence_verified",true),
  includes("risk_level",["low","medium"])
 ]})
]);
const BOOL_FIELDS=["emergency_stop","source_trusted","context_complete","service_ready","evidence_verified","rea_tool_requested","operator_approved"];
const FIELDS=new Set([...BOOL_FIELDS,"mode","risk_level"]);
export function normalizeFacts(source){
 if(!source||typeof source!=="object"||Array.isArray(source))throw Error("FACTS_OBJECT_REQUIRED");
 const keys=Object.keys(source);
 if(keys.length>12||keys.some(x=>!FIELDS.has(x)))throw Error("UNKNOWN_FACTS_REJECTED");
 const facts={emergency_stop:false,source_trusted:false,context_complete:false,service_ready:false,evidence_verified:false,rea_tool_requested:false,operator_approved:false,mode:"observe",risk_level:"unknown"};
 for(const key of BOOL_FIELDS)if(key in source){
  if(typeof source[key]!=="boolean")throw Error("BOOLEAN_FACT_REQUIRED:"+key);
  facts[key]=source[key];
 }
 if("mode" in source){
  if(!["observe","propose","execute"].includes(source.mode))throw Error("MODE_NOT_ALLOWED");
  facts.mode=source.mode;
 }
 if("risk_level" in source){
  if(!["low","medium","high","critical","unknown"].includes(source.risk_level))throw Error("RISK_NOT_ALLOWED");
  facts.risk_level=source.risk_level;
 }
 return facts;
}
export function policySummary(){
 return {version:RULE_VERSION,engine:"json-rules-engine",policyRules:POLICY.length,mode:"read_only_deterministic",reaExecution:false,sideEffects:false,default:"HOLD"};
}
export async function evaluateSituation(input){
 const facts=normalizeFacts(input);
 const engine=new Engine(POLICY,{allowUndefinedFacts:false});
 const result=await engine.run(facts);
 const hits=result.events.map(e=>String(e.type));
 const blockers=hits.filter(x=>x.startsWith("HOLD_"));
 const allow=hits.find(x=>x==="PROPOSE_FOR_OPERATOR_REVIEW"||x==="OBSERVE_BOUNDED");
 const verdict=blockers[0]||allow||"HOLD_NO_MATCH";
 // The operator_approved fact is evidentiary only, never a capability token.
 return {version:RULE_VERSION,decision:verdict,blocked:verdict.startsWith("HOLD_"),
  reviewOnly:true,executeAuthorized:false,reaToolsExecuted:0,matches:hits,facts};
}
