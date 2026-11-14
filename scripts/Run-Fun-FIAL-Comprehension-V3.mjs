// One-shot FIAL 3 comprehension audit. Entirely offline, no Qwen requests.
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {homedir} from "node:os";
import {compileComprehension} from "../src/fial/comprehension-compiler-v3.mjs";
import {runComprehensionAudit} from "../src/fial/comprehension-audit-v3.mjs";
const home=process.env.LOCALAPPDATA||join(homedir(),"AppData","Local");
const directory=join(home,"FunIndustrial","RealApplicationWorkerV1");
const prog=new URL("../src/fial/programs/grant-comprehension.fial",import.meta.url);
const mode=process.argv[2];
if(process.argv.length!==3||!["--check","--once"].includes(mode)){
 console.error("FIAL3_USAGE=node scripts/Run-Fun-FIAL-Comprehension-V3.mjs --check|--once");
 process.exitCode=2;
}else{
 try{
  const source=await readFile(prog,"utf8");
  const language=compileComprehension(source);
  if(mode==="--check"){
   console.log("FIAL3_COMPILER=PASS VERSION="+language.version);
   console.log("FIAL3_CHECKS="+language.checks.join(","));
   console.log("FIAL3_AUTHORITY=OFFLINE_LOCAL_CASE_AUDIT_ONLY");
  }else{
   const report=JSON.parse(await readFile(join(directory,"last-run.json"),"utf8"));
   const saved=JSON.parse(await readFile(join(directory,"fial","semantic-v2","last-run.json"),"utf8"));
   const result=await runComprehensionAudit({source,report,semanticReceipt:saved,directory});
   console.log("FIAL3_RUNTIME=PASS STATUS="+result.status);
   console.log("FIAL3_AUDITED_CASES="+result.count);
   console.log("FIAL3_PLAUSIBLE_PARAPHRASES="+result.plausible_claims);
   console.log("FIAL3_HELD_INTERPRETATIONS="+result.claims_held);
   console.log("FIAL3_PROVEN_ENTAILMENTS="+result.claims_proven_by_entailment);
   console.log("FIAL3_VERIFIED_ELIGIBILITIES="+result.verified_eligibilities);
   for(const c of result.cases){
    console.log("FIAL3_GRANT="+c.grant_id+" OUTCOME="+c.outcome+
      " PLAUSIBLE="+c.plausible_claims+" HELD="+c.held_claims);
    console.log("FIAL3_AUDIT="+c.summary_file);
   }
   console.log("FIAL3_SQLITE="+result.sqlite_memory);
   console.log("FIAL3_REPORT="+join(directory,"fial","semantic-v3","last-run.json"));
   console.log("FIAL3_PERMISSIONS=NO_QWEN_NO_NETWORK_NO_REA_NO_SUBMISSIONS_NO_SPENDING");
  }
 }catch(error){
  console.error("FIAL3_HOLD="+String(error?.message||error).slice(0,260));
  process.exitCode=1;
 }
}
