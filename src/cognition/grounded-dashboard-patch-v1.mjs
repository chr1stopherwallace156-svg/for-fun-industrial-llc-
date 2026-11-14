import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const server=join(root,"server.mjs");
const text=readFileSync(server,"utf8");
const anchor="const server=http.createServer(async(req,res)=>{try{";
if(text.split(anchor).length!==2)throw Error("SERVER_ANCHOR_MISMATCH");
if(text.includes("FI_GROUNDED_RESEARCH_ROUTE_V1"))throw Error("ROUTE_ALREADY_PRESENT");
const insertion=`
  // FI_GROUNDED_RESEARCH_ROUTE_V1
  if(req.method==="POST"&&req.url==="/api/research/grounded-answer"){
    if(!localRequest(req,res))return;
    const body=await readBody(req,12000);
    const data=typeof body==="string"?JSON.parse(body):body;
    if(!data||typeof data!=="object"||Array.isArray(data))return json(res,400,{error:"GROUNDING_REQUEST_INVALID"});
    const {answerWithGroundedClaim}=await import("./cognition/grounded-qwen-v1.mjs");
    const database=process.env.FUN_EVIDENCE_DATABASE;
    const python=process.env.FUN_COGNITION_PYTHON;
    if(!database||!python)return json(res,503,{error:"GROUNDING_NOT_CONFIGURED"});
    try{
      const result=await answerWithGroundedClaim({database,python,claim_id:data.claim_id,question:data.question});
      return json(res,200,result);
    }catch(e){return json(res,422,{error:"GROUNDING_HOLD",detail:String(e.message||e).slice(0,300)});}
  }
`;
const patched=text.replace(anchor,anchor+insertion);
const target=join(root,"server.grounded-review.mjs");
writeFileSync(target,patched,{flag:"wx"});
console.log("STAGE793_REVIEW_FILE="+target);
console.log("ORIGINAL_SERVER_UNCHANGED=TRUE");
console.log("ROUTE=/api/research/grounded-answer");
