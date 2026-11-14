const PORT=Number(process.env.LLAMA_CPP_PORT||8088);
const SYSTEM="You extract business opportunities from user text. Respond with exactly one JSON object, no markdown, no explanation, no reasoning. Schema: {\"opportunities\":[{\"name\":\"string\",\"scores\":{}}],\"criteria\":[],\"missing_evidence\":[]}. Only include numeric scores explicitly supplied by the user. Never invent scores. If no scores are supplied, use empty scores objects. Do not execute tools.";
function clean(x){return String(x||"").trim().slice(0,120)}
function recover(s){const t=String(s||"").replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();try{return JSON.parse(t)}catch{}const a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch{}}throw Error("EXTRACTION_INVALID_JSON")}
function grounded(question,name,key,value){const q=question.toLowerCase(),n=name.toLowerCase(),k=key.toLowerCase();const p=q.indexOf(n);if(p<0)return false;const section=q.slice(p,p+240);return new RegExp("\\b"+k+"\\s*(?:[:=]|is\\s+)?\\s*"+value+"\\b","i").test(section)}
export async function extractBusinessAnalysis(question,{timeoutMs=90000}={}){
if(typeof question!=="string"||!question.trim()||question.length>3000)throw Error("INVALID_ANALYSIS_QUESTION");
const response=await fetch("http://127.0.0.1:"+PORT+"/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:[{role:"system",content:SYSTEM},{role:"user",content:question}],temperature:0,max_tokens:1200,stream:false}),signal:AbortSignal.timeout(timeoutMs)});
if(!response.ok)throw Error("EXTRACTION_HTTP_"+response.status);
const raw=await response.json();const message=raw.choices?.[0]?.message||{};const parsed=recover(message.content);
if(!parsed||!Array.isArray(parsed.opportunities))throw Error("EXTRACTION_INVALID_SCHEMA");
const opportunities=parsed.opportunities.slice(0,8).filter(x=>x&&typeof x.name==="string").map(x=>{const name=clean(x.name);const scores={};for(const [k,v] of Object.entries(x.scores&&typeof x.scores==="object"?x.scores:{})){if(["demand","margin","feasibility","evidence"].includes(k)&&Number.isInteger(v)&&v>=0&&v<=10&&grounded(question,name,k,v))scores[k]=v}return {name,scores}}).filter(x=>x.name);
const missing=Array.isArray(parsed.missing_evidence)?parsed.missing_evidence.slice(0,12).map(clean):[];if(opportunities.some(x=>Object.keys(x.scores).length<4)&&!missing.length)missing.push("verified demand, margin, feasibility, and evidence scores");
return {state:opportunities.length?"extracted_unverified":"needs_evidence",opportunities,criteria:Array.isArray(parsed.criteria)?parsed.criteria.slice(0,8).map(clean):[],missing_evidence:missing,external_actions:0};
}
