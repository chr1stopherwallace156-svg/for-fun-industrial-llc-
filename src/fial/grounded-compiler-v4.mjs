// FIAL 4: fixed, read-only source-grounded review grammar.
export const FIAL4_VERSION="fial-grounded-bytecode-v0.4";
export class Fial4SyntaxError extends Error {
 constructor(line,code){super("FIAL4_LINE_"+line+"_"+code);this.name="Fial4SyntaxError"}
}
export function compileGrounded(source){
 if(typeof source!=="string"||Buffer.byteLength(source,"utf8")>8192)
  throw new Fial4SyntaxError(0,"SOURCE_LIMIT");
 const rows=source.replace(/^\uFEFF/,"").split(/\r?\n/)
  .map((text,i)=>({text:text.trim(),line:i+1}))
  .filter(x=>x.text&&!x.text.startsWith("#"));
 const expected=["FIAL 4",null,"SOURCE VERIFIED_SNAPSHOT","AUDIT SAVED_FIAL2_AND_FIAL3",
  "VERIFY SHA256,RECORD_IDENTITY,FIELD_QUOTES,CLAIM_CONSISTENCY,CONTRADICTIONS",
  "POLICY UNPROVEN_IS_HOLD","END"];
 const fail=(i,why)=>{throw new Fial4SyntaxError(rows[i]?.line||0,why)};
 if(rows.length!==expected.length)fail(rows.length,"EXACTLY_SEVEN_STATEMENTS_REQUIRED");
 for(let i=0;i<expected.length;i++)if(expected[i]&&rows[i].text!==expected[i])
  fail(i,"EXPECTED_"+i);
 const mission=/^MISSION "([^"]{4,140})"$/.exec(rows[1].text);
 if(!mission)fail(1,"MISSION_REQUIRED");
 return Object.freeze({version:FIAL4_VERSION,mission:mission[1],maxCases:3,
  checks:Object.freeze(["SHA256","RECORD_IDENTITY","FIELD_QUOTES",
   "CLAIM_CONSISTENCY","CONTRADICTIONS"]),
  permissions:Object.freeze({network:false,modelCalls:false,rea:false,submissions:false,
   spending:false,serviceRestarts:false,eligibilityCertification:false})});
}
