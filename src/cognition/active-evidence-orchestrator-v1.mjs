import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {orchestrateEvidence} from "./evidence-orchestrator-v1.mjs";
import {preserveSourceContent} from "./source-content-provenance-v1.mjs";
const hash=b=>createHash("sha256").update(b).digest("hex");
export async function activateEvidenceWorkflow({database,python,plan_id,task_id,url,operatorApproved=false,inspect,claim_text}){
if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
if(typeof inspect!=="function")throw Error("INSPECTOR_REQUIRED");
if(![database,python,plan_id,task_id,url,claim_text].every(x=>typeof x==="string"&&x.trim()))throw Error("ACTIVE_EVIDENCE_INPUT_INVALID");
if(Buffer.byteLength(claim_text,"utf8")>1000)throw Error("CLAIM_TOO_LARGE");
let verifiedContent=null;
const approvedInspect=async args=>{
const result=await inspect(args);
if(result?.state!=="retrieved_unverified"||result?.source_url!==url||result?.verification_status!=="source_retrieved_claims_unverified"||result?.score_eligible!==false||result?.external_actions!==1)throw Error("INSPECTION_BOUNDARY_HOLD");
if(!Buffer.isBuffer(result.content))throw Error("INSPECTION_CONTENT_BYTES_REQUIRED");
const bytes=Buffer.from(result.content);
if(bytes.length>262144||bytes.length!==result.bytes||hash(bytes)!==result.content_sha256)throw Error("INSPECTION_CONTENT_HASH_MISMATCH");
if(!bytes.includes(Buffer.from(claim_text,"utf8")))throw Error("CLAIM_NOT_IN_SOURCE");
verifiedContent=bytes;
const {content,...metadata}=result;
return metadata;
};
const research=await orchestrateEvidence({database,python,plan_id,task_id,url,operatorApproved:true,inspect:approvedInspect});
if(!verifiedContent)throw Error("INSPECTION_CONTENT_NOT_CAPTURED");
const preserved=preserveSourceContent({database,python,plan_id,task_id,content:verifiedContent,expected_sha256:research.source_sha256});
const script=["import sys,json,importlib.util,pathlib","p=pathlib.Path(sys.argv[1])","s=importlib.util.spec_from_file_location(\"active_provenance\",p)","m=importlib.util.module_from_spec(s)","s.loader.exec_module(m)","x=json.load(sys.stdin)","r=m.activate(x[\"database\"],x[\"inspection_id\"],x[\"content_id\"],x[\"claim_text\"])","v=m.claim.verify_claim(x[\"database\"],r[\"claim_id\"])","print(json.dumps({\"activation\":r,\"verification\":v}))"].join("\n");
const p=spawnSync(python,["-B","-c",script,new URL("./active-provenance-v1.py",import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1")],{input:JSON.stringify({database,inspection_id:research.source_inspection_id,content_id:preserved.id,claim_text}),encoding:"utf8",timeout:20000,maxBuffer:1048576});
if(p.status!==0)throw Error("ACTIVE_PROVENANCE_HOLD: "+String(p.stderr||p.error||"unknown").slice(0,1000));
const final=JSON.parse(p.stdout);
if(final.verification?.state!=="textual_provenance_verified_claims_unverified")throw Error("PROVENANCE_READBACK_HOLD");
return {state:"active_evidence_persisted_claims_unverified",plan_id,task_id,source_inspection_id:research.source_inspection_id,content_id:preserved.id,binding_id:final.activation.binding_id,claim_id:final.activation.claim_id,passage:final.activation.passage,byte_start:final.activation.byte_start,byte_end:final.activation.byte_end,passage_sha256:final.activation.passage_sha256,content_sha256:research.source_sha256,assessment:research.assessment,source_authenticity_verified:false,factual_claim_verified:false,score_eligible:false,external_actions_executed_by_integration:0,inspection_reported_external_actions:research.inspection_reported_external_actions};
}
