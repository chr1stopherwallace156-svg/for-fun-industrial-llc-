import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {activateEvidenceWorkflow} from "./active-evidence-orchestrator-v1.mjs";
import {answerWithGroundedClaim} from "./grounded-qwen-v1.mjs";
const python=process.argv[2],original=process.argv[3];
const dir=mkdtempSync(join(tmpdir(),"fun-stage798-"));
const database=join(dir,"test.sqlite");
const run=(script,args=[])=>{const p=spawnSync(python,["-B","-c",script,...args],{encoding:"utf8",timeout:30000,maxBuffer:1048576});if(p.status!==0)throw Error(String(p.stderr||p.error||"PYTHON_HOLD"));return p.stdout.trim()};
try{
run(["import sqlite3,sys","a=sqlite3.connect(sys.argv[1])","b=sqlite3.connect(sys.argv[2])","a.backup(b)","b.close()","a.close()"].join("\n"),[original,database]);
const body=Buffer.from("Synthetic research fixture: Fleet demand remains unverified. No market demand has been established.","utf8");
const sha=createHash("sha256").update(body).digest("hex");
const url="https://example.org/stage798-synthetic";
const inspect=async()=>({state:"retrieved_unverified",source_url:url,content:body,content_sha256:sha,bytes:body.length,retrieved_utc:new Date().toISOString(),score_eligible:false,verification_status:"source_retrieved_claims_unverified",external_actions:1,excerpt:body.toString("utf8")});
const result=await activateEvidenceWorkflow({database,python,plan_id:"070b202f-1a78-41ae-aaec-7f8cc859417b",task_id:"OP1-DEMAND",url,operatorApproved:true,inspect,claim_text:"Fleet demand remains unverified"});
console.log("STAGE798_PROVENANCE=PASS");
const answer=await answerWithGroundedClaim({database,python,claim_id:result.claim_id,question:"What does this evidence establish about fleet demand?"});
console.log("STAGE798_LIVE_QWEN=PASS");
console.log("CITATION_VALIDATION="+answer.state);
console.log("CLAIM_ID="+answer.claim_id);
console.log("QWEN_REPLY="+answer.reply.slice(0,1200));
console.log("FACTUAL_CLAIM_VERIFIED="+answer.factual_claim_verified);
console.log("PRODUCTION_DATABASE_WRITES=0 SERVICES_RESTARTED=0");
}catch(e){console.error("STAGE798_LIVE_QWEN=HOLD");console.error(String(e.stack||e));process.exitCode=1}finally{rmSync(dir,{recursive:true,force:true})}
