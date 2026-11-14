// Operator-invoked, single-shot FIAL 4 audit. No network or local model access.
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {homedir} from "node:os";
import {compileGrounded} from "../src/fial/grounded-compiler-v4.mjs";
import {runGroundedReview} from "../src/fial/grounded-review-v4.mjs";
const data=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
 "FunIndustrial","RealApplicationWorkerV1");
const program=new URL("../src/fial/programs/grant-grounded.fial",import.meta.url);
const mode=process.argv[2];
if(process.argv.length!==3||!["--check","--once"].includes(mode)){
 console.error("FIAL4_USAGE=node scripts/Run-Fun-FIAL-Grounded-V4.mjs --check|--once");
 process.exitCode=2;
}else try{
 const source=await readFile(program,"utf8");
 const compiled=compileGrounded(source);
 if(mode==="--check"){
  console.log("FIAL4_COMPILER=PASS VERSION="+compiled.version);
  console.log("FIAL4_CHECKS="+compiled.checks.join(","));
  console.log("FIAL4_AUTHORITY=LOCAL_OFFLINE_REVIEW_ONLY");
 }else{
  const [report,semanticReceipt,comprehensionReceipt]=await Promise.all([
   readFile(join(data,"last-run.json"),"utf8").then(JSON.parse),
   readFile(join(data,"fial","semantic-v2","last-run.json"),"utf8").then(JSON.parse),
   readFile(join(data,"fial","semantic-v3","last-run.json"),"utf8").then(JSON.parse)]);
  const receipt=await runGroundedReview({source,report,semanticReceipt,
   comprehensionReceipt,directory:data});
  console.log("FIAL4_RUNTIME=PASS STATUS="+receipt.status);
  console.log("FIAL4_CASES="+receipt.cases_audited);
  console.log("FIAL4_QUOTES_CHECKED="+receipt.quotes_checked);
  console.log("FIAL4_CLAIMS_HELD="+receipt.claims_held);
  console.log("FIAL4_PROVEN_ENTAILMENTS="+receipt.semantic_entailments_proven);
  console.log("FIAL4_VERIFIED_ELIGIBILITIES="+receipt.verified_eligibilities);
  for(const c of receipt.cases){
   console.log("FIAL4_GRANT="+c.grant_id+" OUTCOME="+c.outcome+
    " CLAIMS="+c.claims_checked+" HELD="+c.claims_held);
   console.log("FIAL4_AUDIT="+c.summary_file);
  }
  console.log("FIAL4_REPORT="+join(data,"fial","grounded-v4","last-run.json"));
  console.log("FIAL4_PERMISSIONS=NO_NETWORK_NO_QWEN_NO_REA_NO_SUBMISSIONS_NO_SPENDING_NO_RESTARTS");
 }
}catch(error){
 console.error("FIAL4_HOLD="+String(error?.message||error).slice(0,260));
 process.exitCode=1;
}
