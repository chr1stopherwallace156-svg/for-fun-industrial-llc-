// FIAL 5 -- system-wide coordination grammar. Not a grants-only interpreter.
export const FIAL5_BYTECODE="fial-system-bytecode-v0.5";
export class Fial5SyntaxError extends Error{
 constructor(line,code){super("FIAL5_LINE_"+line+"_"+code);this.name="Fial5SyntaxError";}
}
export function compileFialSystem(source){
 if(typeof source!=="string"||Buffer.byteLength(source,"utf8")>4096)
  throw new Fial5SyntaxError(0,"SOURCE_LIMIT");
 const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/)
  .map((raw,i)=>({text:raw.trim(),line:i+1}))
  .filter(x=>x.text&&!x.text.startsWith("#"));
 const expected=["FIAL 5",null,"SCOPE FUN_INDUSTRIAL",
  "OBSERVE REGISTERED_MODULES",
  "CHECK IDENTITY,HEALTH,EVIDENCE_HASH,CHANGE",
  "POLICY UNKNOWN_IS_HOLD",
  "AUTHORITY OBSERVE_AND_RECORD_ONLY",
  "END"];
 if(lines.length!==expected.length)throw new Fial5SyntaxError(0,"EXPECTED_EIGHT_STATEMENTS");
 for(let i=0;i<expected.length;i++)if(expected[i]&&lines[i].text!==expected[i])
  throw new Fial5SyntaxError(lines[i].line,"INVALID_STAGE_"+i);
 const name=/^MISSION "([^"]{4,120})"$/.exec(lines[1].text);
 if(!name)throw new Fial5SyntaxError(lines[1].line,"MISSION_INVALID");
 return Object.freeze({bytecode:FIAL5_BYTECODE,mission:name[1],scope:"FUN_INDUSTRIAL",
  policy:"UNKNOWN_IS_HOLD",observation:"REGISTERED_MODULES",
  permissions:Object.freeze({
   arbitraryNetwork:false,externalToolExecution:false,reaExecution:false,
   processModification:false,serviceRestart:false,submissions:false,
   spending:false,localModelInference:false,systemFileMutation:false
  })});
}
