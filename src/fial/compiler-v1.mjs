// FIAL v0.1 - Fun Industrial Autonomous Language: parser, compiler and bounded bytecode.
// Own textual grammar, not JavaScript/Python code disguised as an agent prompt.
export const FIAL_VERSION="fial-bytecode-v0.1";
export class FialSyntaxError extends Error {
  constructor(line,message){super('FIAL_SYNTAX_LINE_'+line+': '+message);this.name="FialSyntaxError";this.line=line}
}
const triggers=new Set(["new","changed","deferred","urgent","missing_evidence","always"]);
const actions=new Set(["BRIEF","HOLD","REMEMBER"]);
const match=(line,re,n,why)=>{const x=re.exec(line);if(!x)throw new FialSyntaxError(n,why);return x};
const fixed=(s,min,max,n,label)=>{if(s.length<min||s.length>max||/[\x00-\x1f\x7f]/.test(s))throw new FialSyntaxError(n,label);return s};
export function compileFial(source){
 if(typeof source!=="string"||Buffer.byteLength(source,"utf8")>16384)
  throw new FialSyntaxError(0,"SOURCE_LIMIT_16KB");
 const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/);
 if(lines.length>120)throw new FialSyntaxError(0,"TOO_MANY_LINES");
 const code=[];const seen=new Set();let stage=0,mission=null,budget=null,sourceName=null,ended=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim(),n=i+1;
  if(!line||line.startsWith("#"))continue;
  if(stage===0){if(line!=="FIAL 1")throw new FialSyntaxError(n,"EXPECTED_FIAL_1");stage=1;continue}
  if(stage===1){mission=fixed(match(line,/^MISSION "([^"]+)"$/,n,"EXPECTED_MISSION")[1],4,120,n,"INVALID_MISSION");stage=2;continue}
  if(stage===2){sourceName=match(line,/^SOURCE (GRANTS)$/,n,"ONLY_GRANTS_SOURCE_SUPPORTED")[1];stage=3;continue}
  if(stage===3){budget=Number(match(line,/^BUDGET ([0-9]+)$/,n,"EXPECTED_BUDGET")[1]);if(!Number.isInteger(budget)||budget<0||budget>5)throw new FialSyntaxError(n,"BUDGET_MUST_BE_0_TO_5");stage=4;continue}
  if(stage===4){
   if(line==="END"){
    if(code.length===0||code.length>12)throw new FialSyntaxError(n,"EXPECTED_1_TO_12_RULES");
    if(!code.some(x=>x.when==="always"))throw new FialSyntaxError(n,"REQUIRES_DEFAULT_ALWAYS_RULE");
    stage=5;ended=true;continue;
   }
   const x=match(line,/^RULE "([a-z][a-z0-9_-]{0,39})" WHEN ([a-z_]+) SCORE (\d{1,3}) ACTION ([A-Z_]+)$/,n,
    'EXPECTED_RULE_NAME_WHEN_SCORE_ACTION');
   const [,name,when,scoreText,action]=x,score=Number(scoreText);
   if(seen.has(name))throw new FialSyntaxError(n,"DUPLICATE_RULE_NAME");
   if(!triggers.has(when))throw new FialSyntaxError(n,"UNSUPPORTED_CONDITION");
   if(!actions.has(action))throw new FialSyntaxError(n,"ACTION_NOT_ALLOWED");
   if(score>100)throw new FialSyntaxError(n,"SCORE_LIMIT_100");
   seen.add(name);
   code.push(Object.freeze({opcode:"TEST_RULE",name,when,score,action,line:n}));
   continue;
  }
  throw new FialSyntaxError(n,"TRAILING_STATEMENT_AFTER_END");
 }
 if(!ended)throw new FialSyntaxError(lines.length,"PROGRAM_INCOMPLETE");
 return Object.freeze({bytecode:FIAL_VERSION,mission,source:sourceName,budget,
  instructions:Object.freeze(code),maximumInstructions:code.length*60,
  authority:Object.freeze({publicNetwork:false,applicationSubmission:false,
   toolExecution:false,externalMessaging:false,spending:false})});
}
export function decompileFial(compiled){
 if(compiled?.bytecode!==FIAL_VERSION)throw Error("FIAL_UNKNOWN_BYTECODE");
 return ["FIAL 1",'MISSION "'+compiled.mission+'"',"SOURCE "+compiled.source,
  "BUDGET "+compiled.budget,
  ...compiled.instructions.map(x=>'RULE "'+x.name+'" WHEN '+x.when+' SCORE '+x.score+' ACTION '+x.action),"END"].join("\n")+"\n";
}
