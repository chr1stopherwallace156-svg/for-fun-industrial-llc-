import {spawnSync} from "node:child_process";
import {retrieveApprovedPage} from "./approved-single-page-retrieval-v1.mjs";
import {activateEvidenceWorkflow} from "./active-evidence-orchestrator-v1.mjs";

const preflightScript=[
"import sys,sqlite3,json,pathlib",
"db,plan,task=sys.argv[1:]",
"c=sqlite3.connect(pathlib.Path(db).resolve().as_uri()+'?mode=ro',uri=True,timeout=5)",
"try:",
" row=c.execute('SELECT plan_json FROM plans WHERE id=?',(plan,)).fetchone()",
" if row is None:raise ValueError('PLAN_NOT_FOUND')",
" tasks=[t for o in json.loads(row[0]).get('opportunities',[]) for t in o.get('tasks',[])]",
" if not any(t.get('id')==task for t in tasks):raise ValueError('TASK_NOT_IN_PLAN')",
" n=c.execute('SELECT COUNT(*) FROM evidence_records_v1 WHERE plan_id=? AND task_id=?',(plan,task)).fetchone()[0]",
" if not 1<=n<=32:raise ValueError('EVIDENCE_RECORD_COUNT_HOLD:'+str(n))",
" print(json.dumps({'state':'ready','evidence_records':n}))",
"finally:c.close()"
].join("\n");

export function preflightCollection({database,python,plan_id,task_id}){
 if(![database,python,plan_id,task_id].every(x=>typeof x==="string"&&x.trim()))throw Error("COLLECTION_INPUT_INVALID");
 if(!/^[0-9a-f-]{36}$/i.test(plan_id)||!/^OP[1-8]-(DEMAND|MARGIN|FEASIBILITY|EVIDENCE)$/.test(task_id))throw Error("COLLECTION_TASK_INVALID");
 const result=spawnSync(python,["-B","-c",preflightScript,database,plan_id,task_id],{encoding:"utf8",timeout:12000,maxBuffer:65536,windowsHide:true});
 if(result.status!==0)throw Error("COLLECTION_PREFLIGHT_HOLD: "+String(result.stderr||result.error||"unknown").slice(0,350));
 return JSON.parse(result.stdout);
}

// No network occurs before the read-only preflight. The retriever is injectable only
// by direct internal callers (tests); the HTTP route does not accept this parameter.
export async function collectApprovedSource({database,python,plan_id,task_id,url,operatorApproved=false,retriever=retrieveApprovedPage}){
 if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
 if(typeof url!=="string"||!url||typeof retriever!=="function")throw Error("COLLECTION_INPUT_INVALID");
 const preflight=preflightCollection({database,python,plan_id,task_id});
 const captured=await retriever({url,operatorApproved:true});
 if(!captured||typeof captured.claim_text!=="string"||!Buffer.isBuffer(captured.content)||captured.inspection?.content!==captured.content)throw Error("RETRIEVAL_CONTRACT_HOLD");
 try{
  let inspections=0;
  const result=await activateEvidenceWorkflow({database,python,plan_id,task_id,url,operatorApproved:true,claim_text:captured.claim_text,inspect:async({url:requested,operatorApproved:approved})=>{
   inspections++;
   if(inspections!==1||approved!==true||requested!==url)throw Error("INSPECTION_APPROVAL_MISMATCH");
   return captured.inspection;
  }});
  return {...result,preflight_evidence_records:preflight.evidence_records,retrieval_count:1,redirects_followed:0,links_crawled:0};
 }catch(error){
  throw Error("COLLECTION_INCOMPLETE_CHECK_SQLITE_RECORDS: "+String(error.message||error).slice(0,350));
 }
}
