// Lightweight professional writing checks. Local deterministic fallback;
// optional Vale quality gate and Qwen refinement are separate adapters.
export const STYLE_VERSION='fial5.6-business-writing-v1';
const claims=[
 {pattern:/\bguaranteed\s+(grant|funding|profit|approval|success)\b/gi,reason:'Unsupported guaranteed outcome'},
 {pattern:/\b(fully\s+compliant|licensed\s+and\s+approved|officially\s+certified)\b/gi,reason:'Certification or legal-status claim requires primary evidence'},
 {pattern:/\b(we\s+will\s+definitely|100%\s+success)\b/gi,reason:'Absolute business prediction requires reliable evidence'}
];
export function reviewBusinessWriting(text,{audience='business',verifiedClaims=[]}={}){
 if(typeof text!=='string'||text.length<1||text.length>12000||
  !['business','customer','government','internal'].includes(audience)||
  !Array.isArray(verifiedClaims)||verifiedClaims.length>25)
  throw Error('FIAL56_WRITING_INPUT_INVALID');
 const issues=[],lines=text.replace(/\r\n/g,'\n').split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim())continue;
  if(line.length>240)issues.push({line:i+1,code:'EXCESSIVELY_LONG_LINE',suggestion:'Split this paragraph or sentence for readability.'});
  if(/ {3,}/.test(line))issues.push({line:i+1,code:'INCONSISTENT_SPACING',suggestion:'Use consistent spacing.'});
  const repeated=/\b([a-z]{3,})\s+\1\b/gi;
  if(repeated.test(line))issues.push({line:i+1,code:'DUPLICATE_WORD',suggestion:'Remove the duplicated word.'});
  for(const c of claims){
   c.pattern.lastIndex=0;
   if(c.pattern.test(line)&&!verifiedClaims.some(x=>typeof x==='string'&&x===c.reason))
    issues.push({line:i+1,code:'UNVERIFIED_BUSINESS_CLAIM',suggestion:c.reason});
  }
 }
 const sentences=(text.match(/[^.!?\n]+[.!?]+/g)||[]).filter(s=>/[a-zA-Z]/.test(s));
 for(const sentence of sentences.slice(0,120)){
  const words=sentence.trim().split(/\s+/).length;
  if(words>38)issues.push({line:null,code:'LONG_SENTENCE',suggestion:'Split a sentence of '+words+' words into shorter statements.'});
 }
 const nonempty=lines.filter(x=>x.trim());
 if(nonempty.length&&/^[a-z]/.test(nonempty[0].trim()))
  issues.push({line:lines.indexOf(nonempty[0])+1,code:'OPENING_CAPITALIZATION',suggestion:'Capitalize the beginning of the message.'});
 if(nonempty.length&&!/[.!?:;)\]]$/.test(nonempty.at(-1).trim()))
  issues.push({line:lines.indexOf(nonempty.at(-1))+1,code:'MISSING_FINAL_PUNCTUATION',suggestion:'Consider closing punctuation where appropriate.'});
 if(audience==='government'&&!/\b(request|confirm|verify|provide|clarify|application|question|assistance)\b/i.test(text))
  issues.push({line:null,code:'REQUEST_NOT_CLEAR',suggestion:'State the requested agency action or specific question.'});
 const unique=issues.filter((x,i,a)=>a.findIndex(y=>y.code===x.code&&y.line===x.line)===i).slice(0,35);
 return {version:STYLE_VERSION,state:'LOCAL_HEURISTIC_REVIEW_COMPLETE',audience,
  issues:unique,issue_count:unique.length,
  truth_or_eligibility_verified:false,grammar_comprehensive:false,
  external_messages_sent:0,
  note:'Heuristic checks are not an authoritative grammar checker or a factual verification.'};
}
