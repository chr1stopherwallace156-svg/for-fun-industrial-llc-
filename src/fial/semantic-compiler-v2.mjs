// FIAL v0.2: compile a small declarative language for evidence-grounded semantic review.
// This is an additive grammar. FIAL 1 compiler and scheduled workers are untouched.
export const SEMANTIC_BYTECODE="fial-semantic-bytecode-v0.2";
const ALLOWED=new Set(["applicant_type","purpose","description","geography","deadline","funding"]);
export class FialSemanticSyntaxError extends Error{
 constructor(line,msg){super("FIAL2_SYNTAX_LINE_"+line+": "+msg);this.name="FialSemanticSyntaxError";this.line=line}
}
export function compileSemantic(source){
 if(typeof source!=="string"||Buffer.byteLength(source,"utf8")>8192)
  throw new FialSemanticSyntaxError(0,"SOURCE_LIMIT_8KB");
 const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/);
 if(lines.length>75)throw new FialSemanticSyntaxError(0,"SOURCE_LINE_LIMIT");
 const body=lines.map((value,i)=>({value:value.trim(),line:i+1}))
  .filter(x=>x.value&&!x.value.startsWith("#"));
 const fail=(i,msg)=>{throw new FialSemanticSyntaxError(body[i]?.line||lines.length,msg)};
 if(body.length!==9)fail(body.length-1,"EXPECTED_EXACTLY_NINE_STATEMENTS");
 if(body[0].value!=="FIAL 2")fail(0,"EXPECTED_FIAL_2");
 const mission=/^MISSION "([^"]{4,140})"$/.exec(body[1].value);if(!mission)fail(1,"MISSION_INVALID");
 if(body[2].value!=="SOURCE GRANTS")fail(2,"ONLY_VERIFIED_GRANTS_SOURCE");
 const fields=/^UNDERSTAND ([a-z_,]+)$/.exec(body[3].value);
 if(!fields)fail(3,"UNDERSTAND_FIELDS_REQUIRED");
 const selected=fields[1].split(",");
 if(selected.length<2||selected.length>6||new Set(selected).size!==selected.length||
    selected.some(s=>!ALLOWED.has(s)))fail(3,"UNSUPPORTED_UNDERSTANDING_FIELDS");
 if(body[4].value!=="MODEL LOCAL_QWEN")fail(4,"ONLY_EXISTING_LOCAL_QWEN_ALLOWED");
 if(body[5].value!=="GROUND QUOTES")fail(5,"SOURCE_QUOTE_GROUNDING_REQUIRED");
 if(body[6].value!=="POLICY UNKNOWN_IS_HOLD")fail(6,"UNKNOWN_MUST_FAIL_CLOSED");
 const limit=/^BUDGET ([1-3])$/.exec(body[7].value);if(!limit)fail(7,"BUDGET_1_TO_3");
 if(body[8].value!=="END")fail(8,"EXPECTED_END");
 return Object.freeze({version:SEMANTIC_BYTECODE,mission:mission[1],
  fields:Object.freeze(selected),model:"LOCAL_QWEN",grounding:"QUOTES",policy:"UNKNOWN_IS_HOLD",
  budget:Number(limit[1]),permissions:Object.freeze({
   network:"loopback-llama-only",externalTools:false,externalMessages:false,
   applicationSubmissions:false,financialActions:false,shell:false,training:false})});
}
