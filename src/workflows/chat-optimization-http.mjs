// FI_CHAT_OPTIMIZATION_HTTP_V1 — same-origin routes mounted in the existing dashboard.
// No second listener, no REA calls, no background runs, no model-created numeric facts.
import {createChatOptimization} from "./chat-optimization.mjs";
const endpoints=new Set(["/api/ai/chat-optimization/status","/api/ai/chat-optimization/draft",
 "/api/ai/chat-optimization/inspect","/api/ai/chat-optimization/run",
 "/api/ai/chat-optimization/enter-review","/api/ai/chat-optimization/decide"]);
const exact=(x,fields)=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&
 Object.keys(x).length===fields.length&&Object.keys(x).every(k=>fields.includes(k));
export function createChatOptimizationHandler({service=createChatOptimization()}={}){
 return async function handler(req,res,{json,readBody}){
  const route=String(req.url||"").split("?")[0];
  if(!endpoints.has(route))return false;
  const reply=(code,obj)=>json(res,code,obj);
  if(route==="/api/ai/chat-optimization/status"&&req.method==="GET")
   return reply(200,{state:"ready",engine:"phase22-existing",automatic_execution:false,
    approval_required:true,rea_tools_executed:0,model:"external-llama-cpp"});
  if(req.method!=="POST")return reply(405,{error:"CHAT_OPT_METHOD_DENIED"});
  if(req.headers["content-type"]!=="application/json"||
     req.headers["sec-fetch-site"]==="cross-site")
   return reply(403,{error:"CHAT_OPT_ORIGIN_OR_CONTENT_TYPE"});
  if(["/api/ai/chat-optimization/run","/api/ai/chat-optimization/decide"].includes(route)&&
     req.headers["x-fi-optimization-approval"]!=="operator-reviewed")
   return reply(403,{error:"CHAT_OPT_EXPLICIT_OPERATOR_APPROVAL_REQUIRED"});
  let data;
  try{
   data=await readBody(req,12000);
   if(!data||typeof data!=="object"||Array.isArray(data))throw Error("REQUEST_SCHEMA");
   let output;
   if(route==="/api/ai/chat-optimization/draft"){
    if(!exact(data,["goal","candidates"]))throw Error("DRAFT_SCHEMA");
    output=await service.draft(data);
   }else if(route==="/api/ai/chat-optimization/inspect"){
    if(!exact(data,["id"]))throw Error("INSPECT_SCHEMA");
    output=await service.inspect(data.id);
   }else if(route==="/api/ai/chat-optimization/run"){
    if(!exact(data,["id","sha256"]))throw Error("RUN_SCHEMA");
    output=await service.run(data);
   }else if(route==="/api/ai/chat-optimization/enter-review"){
    if(!exact(data,["id","sha256","workflow_id"]))throw Error("REVIEW_SCHEMA");
    output=await service.enterReview(data);
   }else if(route==="/api/ai/chat-optimization/decide"){
    if(!exact(data,["id","sha256","workflow_id","decision"]))throw Error("DECISION_SCHEMA");
    output=await service.decide(data);
   }
   return reply(200,output);
  }catch(e){
   const message=String(e.message||e).slice(0,160);
   const code=/EEXIST|LOCKED/.test(message)?409:
    /MODEL|UNAVAILABLE|HTTP|TIMEOUT/.test(message)?503:422;
   return reply(code,{error:"CHAT_OPT_HOLD",detail:message,operator_action_taken:false});
  }
 };
}
