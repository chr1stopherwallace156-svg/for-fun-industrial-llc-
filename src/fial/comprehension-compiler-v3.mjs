// FIAL 3: a small verifiable language for post-hoc comprehension audits.
// No model calls, source rewriting, shell, submissions or external tools.
export const FIAL3_VERSION="fial-comprehension-bytecode-v0.3";
export class Fial3SyntaxError extends Error{
 constructor(line,code){super("FIAL3_LINE_"+line+"_"+code);this.name="Fial3SyntaxError"}
}
export function compileComprehension(source){
 if(typeof source!=="string"||Buffer.byteLength(source,"utf8")>8192)
  throw new Fial3SyntaxError(0,"SOURCE_LIMIT");
 const statements=source.replace(/^\uFEFF/,"").split(/\r?\n/)
  .map((line,i)=>({line:line.trim(),number:i+1}))
  .filter(x=>x.line&&!x.line.startsWith("#"));
 const fail=(at,code)=>{throw new Fial3SyntaxError(statements[at]?.number||0,code)};
 if(statements.length!==7)fail(6,"EXACTLY_SEVEN_STATEMENTS_REQUIRED");
 if(statements[0].line!=="FIAL 3")fail(0,"EXPECTED_VERSION_3");
 const mission=/^MISSION "([^"]{4,140})"$/.exec(statements[1].line);
 if(!mission)fail(1,"MISSION_REQUIRED");
 if(statements[2].line!=="SOURCE GRANTS")fail(2,"ONLY_VERIFIED_GRANTS_ALLOWED");
 if(statements[3].line!=="AUDIT SAVED_SEMANTIC_CASES")fail(3,"ONLY_SAVED_CASES_ALLOWED");
 if(statements[4].line!=="VERIFY SOURCE_QUOTE,NUMBERS,CERTAINTY,POLARITY,LEXICAL_ALIGNMENT")
  fail(4,"REQUIRED_VERIFICATION_STAGES");
 if(statements[5].line!=="POLICY UNPROVEN_IS_HOLD")fail(5,"UNPROVEN_MUST_HOLD");
 if(statements[6].line!=="END")fail(6,"END_REQUIRED");
 return Object.freeze({version:FIAL3_VERSION,mission:mission[1],
  input:"VERIFIED_SAVED_GRANT_CASES",checks:Object.freeze([
   "SOURCE_QUOTE","NUMBERS","CERTAINTY","POLARITY","LEXICAL_ALIGNMENT"]),
  policy:"UNPROVEN_IS_HOLD",maximumCases:3,
  permissions:Object.freeze({externalNetwork:false,modelCalls:false,
   externalTools:false,applicationSubmissions:false,moneyMovement:false,
   executionAuthority:false})});
}
