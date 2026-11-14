// FIAL 2 standalone semantic review CLI. No daemon, new schedule or other service lifecycle.
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {homedir} from "node:os";
import {compileSemantic} from "../src/fial/semantic-compiler-v2.mjs";
import {runSemanticReview} from "../src/fial/semantic-engine-v2.mjs";
const root=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
 "FunIndustrial","RealApplicationWorkerV1");
const programFile=new URL("../src/fial/programs/grant-understanding.fial",import.meta.url);
const mode=process.argv[2];
if(process.argv.length!==3||!["--check","--once"].includes(mode)){
 console.error("FIAL2_USAGE=node scripts/Run-Fun-FIAL-Semantic-V2.mjs --check|--once");
 process.exitCode=2;
}else{
 try{
  const source=await readFile(programFile,"utf8");
  const compiled=compileSemantic(source);
  if(mode==="--check"){
   console.log("FIAL2_COMPILER=PASS VERSION="+compiled.version);
   console.log("FIAL2_FIELDS="+compiled.fields.join(","));
   console.log("FIAL2_LOCAL_MODEL="+compiled.model+" PORT=8088 RESTART=NO");
   console.log("FIAL2_COMPILER_AUTHORITY=READ_SOURCE_LOCAL_INTERPRETATION_ONLY");
  }else{
   const report=JSON.parse(await readFile(join(root,"last-run.json"),"utf8"));
   const profile=JSON.parse(await readFile(join(root,"business-profile.json"),"utf8"));
   const result=await runSemanticReview({source,report,profile,directory:root});
   if(result.applications_submitted!==0||result.rea_executions!==0||
    result.emails_sent!==0||result.money_spent!==0)
    throw Error("FIAL2_OUT_OF_BOUND_ACTION");
   console.log("FIAL2_RUNTIME=PASS STATE="+result.state);
   console.log("FIAL2_CANDIDATES_REVIEWED="+result.candidates_reviewed);
   console.log("FIAL2_ORIGINAL_CSV_ROWS="+result.records_in_snapshot);
   console.log("FIAL2_EXACT_SOURCE_QUOTES="+result.model_quotes_grounded);
   for(const c of result.cases){
    console.log("FIAL2_GRANT="+c.grant_id+" TITLE="+c.title);
    console.log("FIAL2_SOURCE="+c.record_state+" MODEL="+c.model_status+
     " QUOTES="+c.accepted_quotes+" REJECTED="+c.rejected_quotes);
    console.log("FIAL2_DECISION="+c.decision+" ELIGIBILITY=UNKNOWN");
    console.log("FIAL2_MODEL_ATTEMPTS="+(c.model_attempts??0)+" FINISH_REASON="+(c.model_finish_reason||"unknown"));
    if(c.model_error)console.log("FIAL2_LOCAL_MODEL_NOTE="+c.model_error);
    console.log("FIAL2_BRIEF="+c.brief);
   }
   console.log("FIAL2_SQLITE_MEMORY="+result.sqlite_memory);
   console.log("FIAL2_REPORT="+join(root,"fial","semantic-v2","last-run.json"));
   console.log("FIAL2_PERMISSIONS=NO_SUBMISSIONS_NO_SPENDING_NO_EMAIL_NO_REA");
  }
 }catch(e){
  console.error("FIAL2_HOLD="+String(e?.message||e).slice(0,250));
  process.exitCode=1;
 }
}
