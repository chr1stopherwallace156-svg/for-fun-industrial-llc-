// FIAL v0.1 command line: --check validates syntax; --once interprets against verified local grant evidence.
import {readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {homedir} from "node:os";
import {compileFial} from "../src/fial/compiler-v1.mjs";
import {executeFial} from "../src/fial/interpreter-v1.mjs";
const mode=process.argv[2];
if(process.argv.length!==3||!["--check","--once"].includes(mode)){
 console.error("FIAL_USAGE=node scripts/Run-Fun-FIAL-V1.mjs --check|--once");
 process.exitCode=2;
}else{
 const sourceFile=new URL("../src/fial/programs/grant-research.fial",import.meta.url);
 const root=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
  "FunIndustrial","RealApplicationWorkerV1");
 try{
  const source=await readFile(sourceFile,"utf8");
  const compiled=compileFial(source);
  if(mode==="--check"){
   console.log("FIAL_COMPILER=PASS LANGUAGE="+compiled.bytecode+
    " RULES="+compiled.instructions.length+" BRIEF_BUDGET="+compiled.budget);
   console.log("FIAL_COMPILER_AUTHORITY=LOCAL_RESEARCH_ONLY");
  }else{
   const report=JSON.parse(await readFile(resolve(root,"last-run.json"),"utf8"));
   const profile=JSON.parse(await readFile(resolve(root,"business-profile.json"),"utf8"));
   const outcome=await executeFial({source,report,profile,directory:root});
   console.log("FIAL_RUNTIME=PASS VERSION="+outcome.runtime);
   console.log("FIAL_MISSION="+outcome.mission);
   console.log("FIAL_SOURCE_SHA256="+outcome.source_sha256);
   console.log("FIAL_DECISIONS="+outcome.decisions);
   console.log("FIAL_NEW_BRIEFS="+outcome.briefs.filter(x=>x.new_file).length);
   for(const d of outcome.chosen_actions)
    console.log("FIAL_DECISION="+d.grant_id+" RULE="+d.rule+" ACTION="+d.action+" REASON="+d.reason);
   for(const d of outcome.briefs)console.log("FIAL_BRIEF="+d.path);
   console.log("FIAL_SQLITE_MEMORY="+join(root,"fial","fial-memory-v1.sqlite"));
   console.log("FIAL_REPORT="+join(root,"fial","last-run.json"));
   console.log("FIAL_AUTHORITY=NO_SUBMISSIONS_NO_MESSAGES_NO_SPENDING_NO_REA");
  }
 }catch(error){console.error("FIAL_HOLD="+String(error.message||error).slice(0,280));process.exitCode=1}
}
